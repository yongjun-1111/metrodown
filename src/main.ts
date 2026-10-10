import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import DOMPurify from "dompurify";
import { renderMarkdown, type Heading } from "./render";
import { metaDate, metaStatus, STATUS_KEYS, DATE_KEYS, type FrontMatter } from "./frontmatter";
import { svg } from "./icons";
import { basename, dirname, isMarkdown, relativeParts, resolvePath, samePath } from "./paths";
import { store } from "./store";

type TreeNode = { name: string; path: string; children?: TreeNode[] };
type FileData = { text: string; modifiedMs: number };
// `off` is the scroll offset from heading `id`, so a position survives images loading above it.
type ReadPos = { top: number; id: string | null; off?: number; t: number };
type Row = { node: TreeNode; depth: number; line: number };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  body: $("body"),
  route: $("route"),
  tree: $("tree"),
  filter: $<HTMLInputElement>("filter"),
  rootName: $("rootName"),
  rootPath: $("rootPath"),
  sideFoot: $("sideFoot"),
  doc: $("doc"),
  scroll: $("docScroll"),
  toc: $("toc"),
  progress: $("progress"),
  themeBtn: $("themeBtn"),
  openBtn: $("openBtn"),
  wcMax: $("wcMax"),
  resizer: $("resizer"),
};
const appWindow = getCurrentWindow();
const SESSION_START = Date.now();
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const state = {
  root: null as string | null,
  tree: [] as TreeNode[],
  expanded: new Set<string>(),
  lineOf: new Map<string, number>(),
  mdCount: 0,
  current: null as string | null,
  headings: [] as Heading[],
  outline: [] as Heading[],
  history: [] as string[],
  historyIndex: -1,
  rows: [] as Row[],
  focusIndex: -1,
};
let positions = store.json<Record<string, ReadPos>>("positions", {});

/* ---------------- theme ---------------- */
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const theme = () => store.get("theme") ?? (darkQuery.matches ? "dark" : "light");
function applyTheme() {
  const t = theme();
  document.documentElement.dataset.theme = t;
  el.themeBtn.innerHTML = svg(t === "dark" ? "sun" : "moon", 16);
  el.themeBtn.title = t === "dark" ? "Switch to light theme" : "Switch to dark theme";
}
darkQuery.addEventListener("change", () => {
  if (!store.get("theme")) applyTheme();
});

/* ---------------- lines ---------------- */
// Line 1 is reserved for files at the root; top-level folders take lines 2..9 in order.
function assignLines() {
  state.lineOf.clear();
  let i = 0;
  for (const n of state.tree) if (n.children) state.lineOf.set(n.path.toLowerCase(), 2 + (i++ % 8));
}
function lineFor(path: string | null): number {
  if (!path || !state.root) return 1;
  const parts = relativeParts(state.root, path);
  if (!parts || parts.length < 2) return 1;
  return state.lineOf.get(`${state.root.replace(/\\+$/, "")}\\${parts[0]}`.toLowerCase()) ?? 1;
}
const countFiles = (nodes: TreeNode[]): number => nodes.reduce((a, n) => a + (n.children ? countFiles(n.children) : 1), 0);

/* ---------------- tree ---------------- */
function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    if (n.children) {
      const kids = filterTree(n.children, q);
      if (kids.length) out.push({ ...n, children: kids });
    } else if (n.name.toLowerCase().includes(q)) out.push(n);
  }
  return out;
}

function collectRows(nodes: TreeNode[], depth: number, line: number, open: (n: TreeNode) => boolean, out: Row[]) {
  for (const n of nodes) {
    const l = depth === 0 ? (n.children ? state.lineOf.get(n.path.toLowerCase()) ?? 1 : 1) : line;
    out.push({ node: n, depth, line: l });
    if (n.children && open(n)) collectRows(n.children, depth + 1, l, open, out);
  }
}

function highlight(name: string, q: string): string {
  if (!q) return escapeHtml(name);
  const i = name.toLowerCase().indexOf(q);
  if (i < 0) return escapeHtml(name);
  return escapeHtml(name.slice(0, i)) + "<mark>" + escapeHtml(name.slice(i, i + q.length)) + "</mark>" + escapeHtml(name.slice(i + q.length));
}

function rowHtml({ node, depth, line }: Row, index: number, q: string): string {
  const isDir = !!node.children;
  const guides = isDir ? depth : Math.max(depth, 1);
  let g = "";
  for (let k = 0; k < guides; k++) g += `<span class="g" style="left:${12 + k * 16 + 7}px"></span>`;
  const tab = index === state.focusIndex ? 0 : -1;
  if (isDir) {
    const open = q ? true : state.expanded.has(node.path.toLowerCase());
    const badge = depth === 0 ? `<span class="badge">${line}</span>` : "";
    return `<div class="row dir l${line}${open ? " open" : ""}" role="treeitem" aria-level="${depth + 1}" aria-expanded="${open}" tabindex="${tab}" data-i="${index}" style="padding-left:${12 + depth * 16}px">${g}<span class="chev">${svg("chevron", 14, 2)}</span>${badge}<span class="nm">${escapeHtml(node.name)}</span></div>`;
  }
  const active = state.current !== null && samePath(node.path, state.current);
  const label = node.name.replace(/\.(md|markdown)$/i, "");
  return `<div class="row file l${line}${active ? " active" : ""}" role="treeitem" aria-level="${depth + 1}" aria-selected="${active}" tabindex="${tab}" data-i="${index}" title="${escapeHtml(node.name)}" style="padding-left:${12 + Math.max(depth, 1) * 16 + 6}px">${g}<span class="stop" style="left:${12 + Math.max(depth - 1, 0) * 16 + 8}px"></span><span class="nm">${highlight(label, q)}</span></div>`;
}

function renderTree() {
  if (!state.root) {
    el.tree.innerHTML = "";
    el.sideFoot.textContent = "";
    return;
  }
  const q = el.filter.value.trim().toLowerCase();
  const nodes = q ? filterTree(state.tree, q) : state.tree;
  const rows: Row[] = [];
  collectRows(nodes, 0, 1, (n) => !!q || state.expanded.has(n.path.toLowerCase()), rows);
  state.rows = rows;
  if (state.focusIndex >= rows.length) state.focusIndex = rows.length - 1;
  if (state.focusIndex < 0) state.focusIndex = Math.max(0, rows.findIndex((r) => state.current && samePath(r.node.path, state.current)));
  el.tree.innerHTML = rows.length
    ? rows.map((r, i) => rowHtml(r, i, q)).join("")
    : `<div class="tree-empty">${q ? "No file names match this filter." : "No Markdown files in this folder."}</div>`;
  el.sideFoot.innerHTML = `<span>${state.mdCount} document${state.mdCount === 1 ? "" : "s"}</span><span>Other files hidden</span>`;
}

function saveExpanded() {
  if (state.root) store.setJson(`expanded:${state.root.toLowerCase()}`, [...state.expanded]);
}

function expandTo(path: string) {
  if (!state.root) return;
  const parts = relativeParts(state.root, path);
  if (!parts) return;
  let acc = state.root.replace(/\\+$/, "");
  for (const p of parts.slice(0, -1)) {
    acc += "\\" + p;
    state.expanded.add(acc.toLowerCase());
  }
  saveExpanded();
}

function activateRow(i: number) {
  const row = state.rows[i];
  if (!row) return;
  state.focusIndex = i;
  if (row.node.children) {
    const key = row.node.path.toLowerCase();
    if (state.expanded.has(key)) state.expanded.delete(key);
    else state.expanded.add(key);
    saveExpanded();
    renderTree();
    focusRow(i);
  } else void openFile(row.node.path);
}

function focusRow(i: number) {
  state.focusIndex = Math.max(0, Math.min(i, state.rows.length - 1));
  el.tree.querySelectorAll<HTMLElement>(".row").forEach((r) => (r.tabIndex = -1));
  const target = el.tree.querySelector<HTMLElement>(`.row[data-i="${state.focusIndex}"]`);
  if (target) {
    target.tabIndex = 0;
    target.focus({ preventScroll: false });
  }
}

el.tree.addEventListener("click", (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>(".row[data-i]");
  if (row) activateRow(Number(row.dataset.i));
});
el.tree.addEventListener("keydown", (e) => {
  const i = state.focusIndex;
  const row = state.rows[i];
  if (!row) return;
  const isOpenDir = !!row.node.children && (el.filter.value.trim() !== "" || state.expanded.has(row.node.path.toLowerCase()));
  switch (e.key) {
    case "ArrowDown": focusRow(i + 1); break;
    case "ArrowUp": focusRow(i - 1); break;
    case "Home": focusRow(0); break;
    case "End": focusRow(state.rows.length - 1); break;
    case "ArrowRight":
      if (row.node.children && !isOpenDir) activateRow(i);
      else if (row.node.children) focusRow(i + 1);
      break;
    case "ArrowLeft":
      if (isOpenDir) activateRow(i);
      else for (let j = i - 1; j >= 0; j--) if (state.rows[j].depth < row.depth) { focusRow(j); break; }
      break;
    case "Enter":
    case " ":
      activateRow(i);
      break;
    default:
      return;
  }
  e.preventDefault();
});

el.filter.addEventListener("input", () => {
  state.focusIndex = 0;
  renderTree();
});
el.filter.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    el.filter.value = "";
    renderTree();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    focusRow(0);
  } else if (e.key === "Enter") {
    const first = state.rows.find((r) => !r.node.children);
    if (first) void openFile(first.node.path);
  }
});

/* ---------------- route breadcrumb ---------------- */
function renderRoute() {
  if (!state.root) {
    el.route.innerHTML = "";
    return;
  }
  const rootName = basename(state.root);
  const line = lineFor(state.current);
  const parts = state.current ? relativeParts(state.root, state.current) ?? [basename(state.current)] : [];
  const stops: { label: string; cls: string; line: number }[] = [{ label: rootName, cls: "", line: 1 }];
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    stops.push({ label: last ? p.replace(/\.(md|markdown)$/i, "") : p, cls: last ? "cur" : "", line: parts.length > 1 ? line : 1 });
  });
  // Long paths keep the root, the folder before the file and the file.
  const shown = stops.length > 5 ? [stops[0], { label: "…", cls: "gap", line }, ...stops.slice(-3)] : stops;
  el.route.innerHTML = shown
    .map((s, i) => {
      const seg = i > 0 ? `<span class="seg l${s.line}" data-tauri-drag-region></span>` : "";
      const dot = s.cls === "gap" ? "" : "<i></i>";
      return `${seg}<span class="rs l${s.line} ${s.cls}" data-tauri-drag-region>${dot}<span data-tauri-drag-region>${escapeHtml(s.label)}</span></span>`;
    })
    .join("");
}

/* ---------------- document ---------------- */
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
  return `<details class="fm"><summary>${svg("chevron", 12, 2)}Front matter ·${rest.length} field${rest.length === 1 ? "" : "s"}</summary><table>${rows}</table></details>`;
}

function assetUrl(src: string): string {
  if (!state.current || /^(https?:|data:|asset:|blob:)/i.test(src) || src.startsWith("#")) return src;
  const clean = src.split(/[?#]/)[0];
  return convertFileSrc(resolvePath(dirname(state.current), clean, state.root));
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "IMG") {
    const src = node.getAttribute("src");
    if (src) node.setAttribute("src", assetUrl(src));
    node.setAttribute("loading", "lazy");
  }
});

function renderDocument(data: FileData, path: string) {
  const { html: raw, meta, headings, words } = renderMarkdown(data.text);
  // Inline styles are stripped below, so keep table column alignment as a data attribute.
  const html = raw.replace(/<(t[hd]) style="text-align:(left|center|right)">/g, '<$1 data-align="$2">');
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["data-lang"],
  });
  const line = lineFor(path);
  const parts = state.root ? relativeParts(state.root, path) : null;
  const folder = parts && parts.length > 1 ? parts[0] : state.root ? basename(state.root) : basename(dirname(path));
  const status = metaStatus(meta);
  const date = metaDate(meta) ?? (data.modifiedMs ? formatDate(data.modifiedMs) : null);
  const minutes = Math.max(1, Math.round(words / 220));
  const bits = [
    `<span class="badge">${line}</span><span class="line">${escapeHtml(folder)}</span>`,
    status ? `<span class="state">${escapeHtml(status)}</span>` : "",
    date ? `<span>Updated ${escapeHtml(date)}</span>` : "",
    `<span>${minutes} min read</span>`,
  ].filter(Boolean);
  el.doc.innerHTML = `<div class="sign">${bits.join('<span class="dot"></span>')}</div>${frontMatterBlock(meta)}<article class="md">${clean}</article>`;
  el.body.className = `body l${line}`;
  state.headings = headings;
  const sections = headings.filter((h) => h.level === 2 || h.level === 3);
  state.outline = sections.length ? sections : headings.filter((h, i) => h.level === 1 && i > 0);
}

function renderOutline(flagId: string | null, flagTime: number) {
  if (state.outline.length < 2) {
    el.body.classList.add("no-outline");
    el.toc.innerHTML = "";
    return;
  }
  el.body.classList.remove("no-outline");
  el.toc.innerHTML = state.outline
    .map((h, i) => {
      const flag = h.id === flagId ? `<span class="flag">${svg("bookmark", 12)}Last read here · ${relativeTime(flagTime)}</span>` : "";
      return `<li class="${h.level === 3 ? "sub" : ""}" data-i="${i}"><a href="#${escapeHtml(h.id)}" data-go="${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>${flag}</li>`;
    })
    .join("");
}

function currentSection(): number {
  const top = el.scroll.getBoundingClientRect().top;
  let cur = 0;
  state.outline.forEach((h, i) => {
    const target = document.getElementById(h.id);
    if (target && target.getBoundingClientRect().top - top <= 120) cur = i;
  });
  const max = el.scroll.scrollHeight - el.scroll.clientHeight;
  if (max > 0 && el.scroll.scrollTop >= max - 4) cur = state.outline.length - 1;
  return cur;
}

function updateReading() {
  const max = el.scroll.scrollHeight - el.scroll.clientHeight;
  el.progress.style.setProperty("--p", String(max > 0 ? el.scroll.scrollTop / max : 0));
  if (!state.outline.length) return;
  const cur = currentSection();
  el.toc.querySelectorAll<HTMLElement>("li").forEach((li) => {
    const i = Number(li.dataset.i);
    li.classList.toggle("done", i < cur);
    li.classList.toggle("cur", i === cur);
  });
}

function saveReadPosition() {
  if (!state.current) return;
  const id = state.outline.length ? state.outline[currentSection()]?.id ?? null : null;
  const top = Math.round(el.scroll.scrollTop);
  const anchor = id ? headingTop(id) : null;
  positions[state.current.toLowerCase()] = { top, id, off: anchor === null ? undefined : top - anchor, t: Date.now() };
  const keys = Object.keys(positions);
  if (keys.length > 400) {
    keys.sort((a, b) => positions[a].t - positions[b].t).slice(0, keys.length - 400).forEach((k) => delete positions[k]);
  }
  store.setJson("positions", positions);
}

let saveTimer = 0;
el.scroll.addEventListener(
  "scroll",
  () => {
    updateReading();
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveReadPosition, 400);
  },
  { passive: true },
);

/** Scroll offset of a heading inside the document pane, or null when it is not rendered. */
function headingTop(id: string): number | null {
  const target = document.getElementById(id);
  if (!target) return null;
  return Math.round(target.getBoundingClientRect().top - el.scroll.getBoundingClientRect().top + el.scroll.scrollTop);
}

function restorePosition(pos: ReadPos) {
  const apply = () => {
    const anchor = pos.id && pos.off !== undefined ? headingTop(pos.id) : null;
    el.scroll.scrollTop = anchor === null ? pos.top : anchor + pos.off!;
  };
  apply();
  // Images above the position change the layout as they load; follow them until the reader scrolls.
  const article = el.doc.querySelector("article");
  let userScrolled = false;
  const stop = () => (userScrolled = true);
  el.scroll.addEventListener("wheel", stop, { once: true, passive: true });
  el.scroll.addEventListener("keydown", stop, { once: true });
  article?.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", () => !userScrolled && apply(), { once: true });
  });
}

function scrollToId(id: string, smooth = true) {
  const target = document.getElementById(id) ?? document.getElementById(id.toLowerCase());
  if (!target) return;
  const top = target.getBoundingClientRect().top - el.scroll.getBoundingClientRect().top + el.scroll.scrollTop - 24;
  el.scroll.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

function showMessage(title: string, body: string, extra = "") {
  el.body.className = "body l1 no-outline";
  el.toc.innerHTML = "";
  el.progress.style.setProperty("--p", "0");
  el.doc.innerHTML = `<section class="state-page"><h1>${escapeHtml(title)}</h1><p>${body}</p>${extra}</section>`;
}

async function openFile(path: string, opts: { push?: boolean; anchor?: string; keepScroll?: boolean } = {}) {
  const sameFile = state.current !== null && samePath(state.current, path);
  if (!sameFile) saveReadPosition();
  const keepTop = el.scroll.scrollTop;
  let data: FileData;
  try {
    data = await invoke<FileData>("read_file", { path });
  } catch (err) {
    showMessage("This file could not be opened", escapeHtml(String(err)));
    return;
  }
  state.current = path;
  if (opts.push !== false && !sameFile) {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(path);
    state.historyIndex = state.history.length - 1;
  }
  if (state.root) store.set(`last:${state.root.toLowerCase()}`, path);
  expandTo(path);
  renderDocument(data, path);
  const saved = positions[path.toLowerCase()];
  const fromEarlierSession = !!saved && saved.t < SESSION_START && saved.top > 200;
  renderOutline(fromEarlierSession && !opts.keepScroll ? saved.id : null, saved?.t ?? 0);
  renderTree();
  renderRoute();
  void appWindow.setTitle(`${basename(path)} — md-viewer`);
  if (opts.keepScroll) el.scroll.scrollTop = keepTop;
  else if (opts.anchor) scrollToId(opts.anchor, false);
  else if (saved) restorePosition(saved);
  else el.scroll.scrollTop = 0;
  updateReading();
  el.tree.querySelector(".row.active")?.scrollIntoView({ block: "nearest" });
  // Let PageDown/Space scroll the document right away, unless the reader is in the tree or filter.
  const focused = document.activeElement;
  if (!focused || focused === document.body || !el.body.contains(focused) || el.scroll.contains(focused)) {
    el.scroll.focus({ preventScroll: true });
  }
}

/* ---------------- links and history ---------------- */
el.doc.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  const href = a.getAttribute("href");
  e.preventDefault();
  if (!href) return;
  if (href.startsWith("#")) {
    scrollToId(decodeURIComponent(href.slice(1)));
  } else if (/^(https?|mailto):/i.test(href)) {
    void openUrl(href);
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && state.current) {
    const [target, hash] = href.split("#");
    const resolved = target ? resolvePath(dirname(state.current), target, state.root) : state.current;
    if (isMarkdown(resolved)) void openFile(resolved, { anchor: hash ? decodeURIComponent(hash) : undefined });
  }
});
el.toc.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>("[data-go]");
  if (!a) return;
  e.preventDefault();
  scrollToId(a.dataset.go!);
});

function goHistory(step: number) {
  const i = state.historyIndex + step;
  if (i < 0 || i >= state.history.length) return;
  state.historyIndex = i;
  void openFile(state.history[i], { push: false });
}

/* ---------------- folders ---------------- */
function recentFolders(): string[] {
  return store.json<string[]>("recent", []);
}

function rememberFolder(root: string) {
  const list = [root, ...recentFolders().filter((r) => !samePath(r, root))].slice(0, 6);
  store.setJson("recent", list);
}

function findReadme(nodes: TreeNode[]): string | null {
  const readme = nodes.find((n) => !n.children && /^readme\.(md|markdown)$/i.test(n.name));
  if (readme) return readme.path;
  const first = (list: TreeNode[]): string | null => {
    for (const n of list) {
      if (!n.children) return n.path;
      const f = first(n.children);
      if (f) return f;
    }
    return null;
  };
  return first(nodes);
}

async function rescan() {
  if (!state.root) return;
  try {
    state.tree = await invoke<TreeNode[]>("scan_tree", { root: state.root });
  } catch (err) {
    state.tree = [];
    showMessage("This folder could not be read", escapeHtml(String(err)));
  }
  state.mdCount = countFiles(state.tree);
  assignLines();
  renderTree();
  renderRoute();
}

async function openRoot(root: string, file?: string) {
  saveReadPosition();
  const trimmed = root.replace(/\\+$/, "");
  // A drive root keeps its separator: "D:" alone would mean the current folder on D.
  state.root = /^[a-zA-Z]:$/.test(trimmed) ? `${trimmed}\\` : trimmed || root;
  state.current = null;
  state.history = [];
  state.historyIndex = -1;
  el.filter.value = "";
  store.set("root", state.root);
  rememberFolder(state.root);
  el.rootName.textContent = basename(state.root);
  el.rootPath.textContent = state.root;
  el.rootPath.title = state.root;
  const saved = store.json<string[] | null>(`expanded:${state.root.toLowerCase()}`, null);
  await rescan();
  state.expanded = new Set(saved ?? state.tree.filter((n) => n.children).map((n) => n.path.toLowerCase()));
  renderTree();
  void invoke("watch_root", { root: state.root }).catch(() => undefined);
  const last = store.get(`last:${state.root.toLowerCase()}`);
  const target = file ?? (last && relativeParts(state.root, last) ? last : null) ?? findReadme(state.tree);
  if (target) await openFile(target);
  else showMessage("No Markdown here", "This folder has no Markdown files. Open another folder to start reading.");
}

async function pickFolder() {
  const picked = await openDialog({ directory: true, multiple: false, title: "Open a folder" });
  if (typeof picked === "string") await openRoot(picked);
}

async function openPath(p: string) {
  const kind = await invoke<string>("path_kind", { path: p });
  if (kind === "dir") await openRoot(p);
  else if (kind === "file" && isMarkdown(p)) {
    if (state.root && relativeParts(state.root, p)) await openFile(p);
    else await openRoot(await invoke<string>("project_root", { path: p }), p);
  }
}

function showWelcome() {
  const recent = recentFolders();
  const list = recent.length
    ? `<div class="recent"><h2>Recent folders</h2>${recent
        .map((r) => `<button data-open="${escapeHtml(r)}"><b>${escapeHtml(basename(r))}</b><span>${escapeHtml(r)}</span></button>`)
        .join("")}</div>`
    : "";
  showMessage(
    "Open a folder to start reading",
    "md-viewer shows the Markdown files in a folder and nothing else. You can also drop a folder or a .md file onto this window.",
    `<button class="primary" data-act="open">${svg("folderOpen", 16)}Open folder</button>${list}`,
  );
}

el.doc.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-open],[data-act]");
  if (!b) return;
  if (b.dataset.act === "open") void pickFolder();
  else if (b.dataset.open) void openPath(b.dataset.open);
});

/* ---------------- file system events ---------------- */
let rescanTimer = 0;
let reloadTimer = 0;
void listen<{ paths: string[]; structural: boolean }>("fs-change", ({ payload }) => {
  if (payload.structural) {
    clearTimeout(rescanTimer);
    rescanTimer = window.setTimeout(() => void rescan(), 300);
  }
  if (state.current && payload.paths.some((p) => samePath(p, state.current!))) {
    clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => {
      if (state.current) void openFile(state.current, { push: false, keepScroll: true });
    }, 150);
  }
});

void getCurrentWebview().onDragDropEvent((e) => {
  if (e.payload.type === "drop" && e.payload.paths.length) void openPath(e.payload.paths[0]);
});

/* ---------------- window chrome ---------------- */
const MAX_ICON = '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" fill="none"><rect x=".5" y=".5" width="9" height="9" rx="1"/></svg>';
const RESTORE_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" fill="none"><rect x=".5" y="2.5" width="7" height="7" rx="1"/><path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1"/></svg>';
async function syncMaxIcon() {
  const max = await appWindow.isMaximized();
  el.wcMax.innerHTML = max ? RESTORE_ICON : MAX_ICON;
  el.wcMax.setAttribute("aria-label", max ? "Restore" : "Maximize");
}
$("wcMin").addEventListener("click", () => void appWindow.minimize());
el.wcMax.addEventListener("click", () => void appWindow.toggleMaximize());
$("wcClose").addEventListener("click", () => {
  saveReadPosition();
  void appWindow.close();
});
void appWindow.onResized(() => void syncMaxIcon());

el.openBtn.innerHTML = `${svg("folderOpen", 15)}Open folder`;
el.openBtn.addEventListener("click", () => void pickFolder());
el.themeBtn.addEventListener("click", () => {
  store.set("theme", theme() === "dark" ? "light" : "dark");
  applyTheme();
});
$("filterIcon").innerHTML = svg("search", 14);

// Sidebar width
const sideWidth = Number(store.get("sideWidth")) || 284;
document.documentElement.style.setProperty("--side-w", `${sideWidth}px`);
el.resizer.addEventListener("pointerdown", (e) => {
  el.resizer.setPointerCapture(e.pointerId);
  el.resizer.classList.add("drag");
  const move = (ev: PointerEvent) => {
    const w = Math.max(200, Math.min(520, ev.clientX));
    document.documentElement.style.setProperty("--side-w", `${w}px`);
    store.set("sideWidth", String(w));
  };
  const up = () => {
    el.resizer.classList.remove("drag");
    el.resizer.removeEventListener("pointermove", move);
    el.resizer.removeEventListener("pointerup", up);
  };
  el.resizer.addEventListener("pointermove", move);
  el.resizer.addEventListener("pointerup", up);
});

/* ---------------- keyboard ---------------- */
addEventListener("keydown", (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "o") {
    e.preventDefault();
    void pickFolder();
  } else if (ctrl && (e.key.toLowerCase() === "p" || (e.shiftKey && e.key.toLowerCase() === "f"))) {
    e.preventDefault();
    el.filter.focus();
    el.filter.select();
  } else if (e.altKey && e.key === "ArrowLeft") {
    e.preventDefault();
    goHistory(-1);
  } else if (e.altKey && e.key === "ArrowRight") {
    e.preventDefault();
    goHistory(1);
  } else if (e.key === "F5" || (ctrl && e.key.toLowerCase() === "r")) {
    e.preventDefault();
    if (state.current) void openFile(state.current, { push: false, keepScroll: true });
  }
});
addEventListener("mouseup", (e) => {
  if (e.button === 3) goHistory(-1);
  else if (e.button === 4) goHistory(1);
});
// Keep the browser menu (Refresh, Save as…) out of the app; allow it for copying a selection.
addEventListener("contextmenu", (e) => {
  if (!window.getSelection()?.toString()) e.preventDefault();
});
addEventListener("beforeunload", saveReadPosition);

/* ---------------- start ---------------- */
async function start() {
  applyTheme();
  void syncMaxIcon();
  try {
    const launch = await invoke<string | null>("launch_path");
    const last = store.get("root");
    if (launch) await openPath(launch);
    else if (last && (await invoke<string>("path_kind", { path: last })) === "dir") await openRoot(last);
    else showWelcome();
  } catch (err) {
    showMessage("Something went wrong while starting", escapeHtml(String(err)));
  }
}

// Show the window after the first frame so it never flashes white.
requestAnimationFrame(() => void appWindow.show());
void start();
