// What is open: the root folder, the current file, history, and the events that change them.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { appWindow, el, escapeHtml } from "./dom";
import { svg } from "./icons";
import { basename, dirname, isMarkdown, pathKey, relativeParts, resolvePath, rootOf, samePath, splitLink } from "./paths";
import { saveReadPosition, scrollToId, showDocument, showMessage } from "./reader";
import { state, type FileData, type TreeNode } from "./state";
import { store } from "./store";
import { clearFilter, expandTo, lineFor, renderRoute, renderTree, restoreExpanded, revealActive, setTree } from "./tree";

type OpenOpts = { push?: boolean; anchor?: string; keepScroll?: boolean; quiet?: boolean };

const history: string[] = [];
let historyIndex = -1;
/** Where a history move that is still loading is heading, so repeated Back presses add up. */
let historyTarget: number | null = null;
// Reads and scans resolve out of order; only the latest request may change what is shown.
let openGen = 0;
let rootGen = 0;
let scanGen = 0;
let pathGen = 0; // opens from outside the document: launch, hand-over, drop, recent folders
/** Resolves once the "open-path" listener is registered. */
let listening: Promise<unknown> = Promise.resolve();

const inRoot = (p: string) => !!state.root && !!relativeParts(state.root, p);

function refreshChrome() {
  renderTree();
  renderRoute();
  void appWindow.setTitle(state.current ? `${basename(state.current)} — Metrodown` : "Metrodown");
}

/** Replaces the document with a message. Nothing is current, so no read position is saved for it. */
function showError(title: string, detail: string) {
  saveReadPosition();
  state.current = null;
  showMessage(title, escapeHtml(detail));
  refreshChrome();
}

/* ---------------- files ---------------- */
/** Opens a file inside the root. Resolves to false when it could not be shown. */
export async function openFile(path: string, opts: OpenOpts = {}): Promise<boolean> {
  const gen = ++openGen;
  const sameFile = state.current !== null && samePath(state.current, path);
  if (!sameFile) saveReadPosition();
  let data: FileData;
  try {
    data = await invoke<FileData>("read_file", { path });
  } catch (err) {
    // `quiet` reloads keep the last version: an editor saving by replace removes the file for a moment.
    if (gen === openGen && !opts.quiet) showError("This file could not be opened", String(err));
    return false;
  }
  if (gen !== openGen) return false;
  state.current = path;
  if (opts.push !== false && !sameFile) {
    history.splice(historyIndex + 1, Infinity, path);
    historyIndex = history.length - 1;
  }
  store.set(`last:${pathKey(state.root!)}`, path);
  expandTo(path);
  showDocument(data, path, lineFor(path), opts);
  refreshChrome();
  revealActive();
  // Let PageDown/Space scroll the document right away, unless the reader is in the tree or filter.
  const focused = document.activeElement;
  if (!focused || focused === document.body || !el.body.contains(focused) || el.scroll.contains(focused)) {
    el.scroll.focus({ preventScroll: true });
  }
  return true;
}

export function reloadCurrent(quiet = false) {
  if (state.current) void openFile(state.current, { push: false, keepScroll: true, quiet });
}

/**
 * Opens an existing Markdown file: in the root, or else in its own project. `wanted` lets a
 * caller drop the open when a newer one started while the project was being looked up.
 */
async function openMarkdown(path: string, opts: OpenOpts = {}, keepHistory = true, wanted = () => true): Promise<boolean> {
  if (inRoot(path)) return openFile(path, opts);
  const root = await invoke<string>("project_root", { path });
  return wanted() && openRoot(root, { ...opts, file: path, keepHistory });
}

/** Opens a Markdown file from a link or history, reporting one that has gone. */
async function openAnywhere(path: string, opts: OpenOpts = {}): Promise<boolean> {
  if (!inRoot(path) && (await invoke<string>("path_kind", { path })) !== "file") {
    showError("This file could not be opened", `File not found: ${path}`);
    return false;
  }
  return openMarkdown(path, opts);
}

export async function goHistory(step: number) {
  const i = (historyTarget ?? historyIndex) + step;
  if (i < 0 || i >= history.length) return;
  historyTarget = i;
  const ok = await openAnywhere(history[i], { push: false });
  if (historyTarget === i) historyTarget = null;
  if (ok) historyIndex = i;
}

function followLink(href: string) {
  if (/^(https?|mailto):/i.test(href)) {
    void openUrl(href);
    return;
  }
  // Other schemes are ignored; everything else is a path relative to the document.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || !state.current) return;
  const { path, hash } = splitLink(href);
  const anchor = hash ?? undefined;
  if (!path) {
    if (anchor) scrollToId(anchor);
    return;
  }
  const resolved = resolvePath(dirname(state.current), path, state.root);
  if (!isMarkdown(resolved)) return;
  // A file outside the root opens its own project, so the tree, route and watcher always match it.
  void openAnywhere(resolved, { anchor });
}

/* ---------------- folders ---------------- */
const recentFolders = () => store.json<string[]>("recent", []);

function rememberFolder(root: string) {
  store.setJson("recent", [root, ...recentFolders().filter((r) => !samePath(r, root))].slice(0, 6));
}

function firstFile(nodes: TreeNode[]): string | null {
  for (const n of nodes) {
    const f = n.children ? firstFile(n.children) : n.path;
    if (f) return f;
  }
  return null;
}

const findReadme = (nodes: TreeNode[]) =>
  nodes.find((n) => !n.children && /^readme\.(md|markdown)$/i.test(n.name))?.path ?? firstFile(nodes);

/** Scans `root`. Resolves to null when another folder was opened meanwhile, or after showing the error. */
async function scan(root: string): Promise<TreeNode[] | null> {
  try {
    const tree = await invoke<TreeNode[]>("scan_tree", { root });
    return state.root === root ? tree : null;
  } catch (err) {
    if (state.root !== root) return null;
    setTree([]);
    showError("This folder could not be read", String(err));
    return null;
  }
}

async function rescan() {
  const gen = ++scanGen;
  const tree = state.root ? await scan(state.root) : null;
  if (!tree || gen !== scanGen) return; // a newer rescan or folder open owns the tree
  setTree(tree);
  refreshChrome();
}

/** Opens a folder and then `target.file`, the last file read there, or its README. */
async function openRoot(root: string, target: OpenOpts & { file?: string; keepHistory?: boolean } = {}): Promise<boolean> {
  const gen = ++rootGen;
  const fileGen = ++openGen; // a read still in flight belongs to the previous folder
  scanGen++; // and so does a pending rescan
  saveReadPosition();
  state.root = rootOf(root);
  state.current = null;
  if (!target.keepHistory) {
    history.length = 0;
    historyIndex = -1;
  }
  clearFilter();
  store.set("root", state.root);
  rememberFolder(state.root);
  el.rootName.textContent = basename(state.root);
  el.rootPath.textContent = el.rootPath.title = state.root;
  const tree = await scan(state.root);
  if (!tree || gen !== rootGen) return false;
  setTree(tree);
  restoreExpanded();
  if (state.current) expandTo(state.current);
  refreshChrome();
  void invoke("watch_root", { root: state.root }).catch(() => undefined);
  if (openGen !== fileGen) return true; // a file opened during the scan (link, hand-over) stays
  const last = store.get(`last:${pathKey(state.root)}`);
  const file = target.file ?? (last && inRoot(last) ? last : null) ?? findReadme(tree);
  if (file) return openFile(file, target);
  showMessage("No Markdown here", "This folder has no Markdown files. Open another folder to start reading.");
  return false;
}

export async function pickFolder() {
  const picked = await openDialog({ directory: true, multiple: false, title: "Open a folder" });
  if (typeof picked === "string") await openRoot(picked);
}

/**
 * Opens a folder, or a Markdown file inside the current root or else inside its own project.
 * `keepHistory` lets Back return to what was open before (files handed over by Windows).
 */
export async function openPath(p: string, keepHistory = false) {
  const gen = ++pathGen;
  const wanted = () => gen === pathGen; // a later drop, hand-over or launch wins
  const kind = await invoke<string>("path_kind", { path: p });
  if (!wanted()) return;
  if (kind === "dir") await openRoot(p);
  else if (kind === "missing") showError("This path no longer exists", p);
  else if (isMarkdown(p)) await openMarkdown(p, {}, keepHistory, wanted);
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
    "Metrodown shows the Markdown files in a folder and nothing else. You can also drop a folder or a .md file onto this window.",
    `<button class="primary" data-act="open">${svg("folderOpen", 16)}Open folder</button>${list}`,
  );
}

/** Reopens what was open last time, or the path the app was launched with. */
export async function startSession() {
  // Once launch_path has answered, later files arrive as "open-path" events, so listen first.
  const gen = pathGen;
  await listening;
  const launch = await invoke<string | null>("launch_path");
  // A path handed over while these calls ran is newer than both the launch path and the last root.
  if (gen !== pathGen) return;
  if (launch) return openPath(launch);
  const last = store.get("root");
  const reopen = !!last && (await invoke<string>("path_kind", { path: last })) === "dir";
  if (gen !== pathGen) return;
  if (reopen) await openRoot(last!);
  else showWelcome();
}

export function initSession() {
  el.doc.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const button = t.closest<HTMLElement>("[data-open],[data-act]");
    if (button?.dataset.act === "open") return void pickFolder();
    if (button?.dataset.open) return void openPath(button.dataset.open);
    const a = t.closest("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href) followLink(href);
  });

  let rescanTimer = 0;
  let reloadTimer = 0;
  void listen<{ paths: string[]; structural: boolean }>("fs-change", ({ payload }) => {
    if (payload.structural) {
      clearTimeout(rescanTimer);
      rescanTimer = window.setTimeout(() => void rescan(), 300);
    }
    if (state.current && payload.paths.some((p) => samePath(p, state.current!))) {
      clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => reloadCurrent(true), 150);
    }
  });

  // A .md file opened from Explorer or a terminal while the app is running (single instance).
  listening = listen<string>("open-path", ({ payload }) => void openPath(payload, true));

  void getCurrentWebview().onDragDropEvent((e) => {
    if (e.payload.type === "drop" && e.payload.paths.length) void openPath(e.payload.paths[0]);
  });
}
