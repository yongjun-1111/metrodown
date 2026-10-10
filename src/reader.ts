// The document pane: rendering, the outline route and read positions.
import { convertFileSrc } from "@tauri-apps/api/core";
import DOMPurify from "dompurify";
import { drawDiagrams } from "./diagrams";
import { el, escapeHtml } from "./dom";
import { DATE_KEYS, metaDate, metaStatus, STATUS_KEYS, type FrontMatter } from "./frontmatter";
import { svg } from "./icons";
import { basename, dirname, relativeParts, resolvePath } from "./paths";
import { renderMarkdown, type Heading } from "./render";
import { state, type FileData } from "./state";
import { store } from "./store";

// `off` is the scroll offset from heading `id`, so a position survives images loading above it.
type ReadPos = { top: number; id: string | null; off?: number; t: number };

const SESSION_START = Date.now();
const MAX_POSITIONS = 400;
const positions = store.json<Record<string, ReadPos>>("positions", {});
let outline: Heading[] = [];
/** Folder of the document being sanitized, for resolving its image paths. */
let docDir = "";
/** Listeners of a restore that is still following images; aborted when anything else sets the scroll. */
let restoring: AbortController | null = null;

function stopRestore() {
  restoring?.abort();
  restoring = null;
}

/* ---------------- rendering ---------------- */
const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function relativeTime(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function frontMatterBlock(meta: FrontMatter | null): string {
  if (!meta) return "";
  const shown = new Set([...STATUS_KEYS, ...DATE_KEYS]);
  const rest = Object.entries(meta).filter(([k]) => !shown.has(k));
  if (!rest.length) return "";
  const rows = rest.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`).join("");
  return `<details class="fm"><summary>${svg("chevron", 12, 2)}Front matter · ${rest.length} field${rest.length === 1 ? "" : "s"}</summary><table>${rows}</table></details>`;
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  // srcset candidates would resolve against the app, not the document; `src` alone is enough.
  node.removeAttribute("srcset");
  if (node.tagName !== "IMG") return;
  const src = node.getAttribute("src");
  if (src && !/^(https?:|data:|asset:|blob:|#)/i.test(src)) {
    node.setAttribute("src", convertFileSrc(resolvePath(docDir, src.split(/[?#]/)[0], state.root)));
  }
  node.setAttribute("loading", "lazy");
});

function sanitize(html: string, path: string): string {
  docDir = dirname(path);
  // Inline styles are stripped, so keep table column alignment as a data attribute.
  const aligned = html.replace(/<(t[hd]) style="text-align:(left|center|right)">/g, '<$1 data-align="$2">');
  return DOMPurify.sanitize(aligned, {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["data-lang"],
  });
}

function signRow(path: string, meta: FrontMatter | null, modifiedMs: number, words: number): string {
  const parts = state.root ? relativeParts(state.root, path) : null;
  const folder = parts && parts.length > 1 ? parts[0] : basename(state.root ?? dirname(path));
  const status = metaStatus(meta);
  const date = metaDate(meta) ?? (modifiedMs ? formatDate(modifiedMs) : null);
  const bits = [
    `<span class="badge"></span><span class="line">${escapeHtml(folder)}</span>`,
    status ? `<span class="state">${escapeHtml(status)}</span>` : "",
    date ? `<span>Updated ${escapeHtml(date)}</span>` : "",
    `<span>${Math.max(1, Math.round(words / 220))} min read</span>`,
  ];
  return `<div class="sign">${bits.filter(Boolean).join('<span class="dot"></span>')}</div>`;
}

function renderOutline(flagId: string | null, flagTime: number) {
  // A single stop is no route; the column is given back to the document.
  const show = outline.length > 1;
  el.body.classList.toggle("no-outline", !show);
  el.toc.innerHTML = !show
    ? ""
    : outline
        .map((h, i) => {
          const flag = h.id === flagId ? `<span class="flag">${svg("bookmark", 12)}Last read here · ${relativeTime(flagTime)}</span>` : "";
          return `<li class="${h.level === 3 ? "sub" : ""}" data-i="${i}"><a href="#${escapeHtml(h.id)}" data-go="${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>${flag}</li>`;
        })
        .join("");
}

/**
 * Shows a document and places the scroll: kept (reload), at an anchor (link), at the saved
 * position (reopen), or at the top.
 */
export function showDocument(data: FileData, path: string, line: number, opts: { anchor?: string; keepScroll?: boolean }) {
  const keepTop = el.scroll.scrollTop;
  const { html, meta, headings, words } = renderMarkdown(data.text);
  el.doc.innerHTML = signRow(path, meta, data.modifiedMs, words) + frontMatterBlock(meta) + `<article class="md">${sanitize(html, path)}</article>`;
  el.body.className = `body l${line}`;
  const sections = headings.filter((h) => h.level === 2 || h.level === 3);
  outline = sections.length ? sections : headings.filter((h, i) => h.level === 1 && i > 0);

  const saved = positions[path.toLowerCase()];
  // The flag is for coming back to a document, not for flipping between documents in one sitting.
  const flagged = !opts.keepScroll && !!saved && saved.t < SESSION_START && saved.top > 200;
  renderOutline(flagged ? saved.id : null, saved?.t ?? 0);
  stopRestore();
  if (opts.keepScroll) el.scroll.scrollTop = keepTop;
  else if (opts.anchor) scrollToId(opts.anchor, false);
  else if (saved) restorePosition(saved);
  else el.scroll.scrollTop = 0;
  updateOutline();
  void drawDiagrams();
}

export function showMessage(title: string, body: string, extra = "") {
  outline = [];
  stopRestore();
  el.body.className = "body l1 no-outline";
  el.toc.innerHTML = "";
  el.doc.innerHTML = `<section class="state-page"><h1>${escapeHtml(title)}</h1><p>${body}</p>${extra}</section>`;
  el.scroll.scrollTop = 0;
}

/* ---------------- headings and scrolling ---------------- */
/** A heading or anchor inside the document. Scoped to the article so app element ids never match. */
function target(id: string): HTMLElement | null {
  const find = (v: string) => el.doc.querySelector<HTMLElement>(`article [id="${CSS.escape(v)}"]`);
  return find(id) ?? find(id.toLowerCase());
}

/** Scroll offset of a heading inside the document pane, or null when it is not rendered. */
function headingTop(id: string): number | null {
  const t = target(id);
  return t ? Math.round(t.getBoundingClientRect().top - el.scroll.getBoundingClientRect().top + el.scroll.scrollTop) : null;
}

export function scrollToId(id: string, smooth = true) {
  const top = headingTop(id);
  if (top === null) return;
  stopRestore();
  el.scroll.scrollTo({ top: top - 24, behavior: smooth ? "smooth" : "auto" });
}

function currentSection(): number {
  const top = el.scroll.getBoundingClientRect().top;
  let cur = 0;
  outline.forEach((h, i) => {
    const t = target(h.id);
    if (t && t.getBoundingClientRect().top - top <= 120) cur = i;
  });
  const max = el.scroll.scrollHeight - el.scroll.clientHeight;
  if (max > 0 && el.scroll.scrollTop >= max - 4) cur = outline.length - 1;
  return cur;
}

function updateOutline() {
  if (!outline.length) return;
  const cur = currentSection();
  el.toc.querySelectorAll<HTMLElement>("li").forEach((li) => {
    const i = Number(li.dataset.i);
    li.classList.toggle("done", i < cur);
    li.classList.toggle("cur", i === cur);
  });
}

/* ---------------- read positions ---------------- */
export function saveReadPosition() {
  if (!state.current) return;
  const id = outline.length ? outline[currentSection()]?.id ?? null : null;
  const top = Math.round(el.scroll.scrollTop);
  const anchor = id ? headingTop(id) : null;
  positions[state.current.toLowerCase()] = { top, id, off: anchor === null ? undefined : top - anchor, t: Date.now() };
  const keys = Object.keys(positions);
  if (keys.length > MAX_POSITIONS) {
    keys.sort((a, b) => positions[a].t - positions[b].t).slice(0, keys.length - MAX_POSITIONS).forEach((k) => delete positions[k]);
  }
  store.setJson("positions", positions);
}

function restorePosition(pos: ReadPos) {
  const apply = () => {
    const anchor = pos.id && pos.off !== undefined ? headingTop(pos.id) : null;
    el.scroll.scrollTop = anchor === null ? pos.top : anchor + pos.off!;
  };
  apply();
  // Images and diagrams above the position change the layout as they load; follow them until
  // the reader takes over.
  const pending = [...el.doc.querySelectorAll<HTMLImageElement>("article img")].filter((img) => !img.complete);
  const diagrams = !!el.doc.querySelector("pre.mermaid-src");
  if (!pending.length && !diagrams) return;
  const { signal } = (restoring = new AbortController());
  for (const type of ["wheel", "keydown", "pointerdown"]) el.scroll.addEventListener(type, stopRestore, { once: true, passive: true, signal });
  pending.forEach((img) => img.addEventListener("load", apply, { once: true, signal }));
  if (diagrams) el.doc.addEventListener("layoutchange", apply, { once: true, signal });
}

export function initReader() {
  let saveTimer = 0;
  el.scroll.addEventListener(
    "scroll",
    () => {
      updateOutline();
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveReadPosition, 400);
    },
    { passive: true },
  );
  el.toc.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-go]");
    if (!a) return;
    e.preventDefault();
    scrollToId(a.dataset.go!);
  });
}
