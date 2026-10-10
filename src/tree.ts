// The line map: the file tree in the sidebar and the route breadcrumb in the title bar.
import { el, escapeHtml } from "./dom";
import { svg } from "./icons";
import { basename, joinPath, relativeParts, samePath } from "./paths";
import { state, type TreeNode } from "./state";
import { store } from "./store";

type Row = { node: TreeNode; depth: number; line: number };

const key = (p: string) => p.toLowerCase();
const stripExt = (name: string) => name.replace(/\.(md|markdown)$/i, "");
const lineOf = new Map<string, number>(); // top-level folder name -> line number
let expanded = new Set<string>();
let fileCount = 0;
let rows: Row[] = [];
let focusIndex = -1;
let onOpen: (path: string) => void = () => undefined;

const query = () => el.filter.value.trim().toLowerCase();
const isOpen = (n: TreeNode, q: string) => q !== "" || expanded.has(key(n.path));
const countFiles = (nodes: TreeNode[]): number => nodes.reduce((a, n) => a + (n.children ? countFiles(n.children) : 1), 0);

/** Replaces the tree. Line 1 is root-level files; top-level folders take lines 2..9 in order. */
export function setTree(nodes: TreeNode[]) {
  state.tree = nodes;
  fileCount = countFiles(nodes);
  lineOf.clear();
  let i = 0;
  for (const n of nodes) if (n.children) lineOf.set(key(n.name), 2 + (i++ % 8));
}

export function lineFor(path: string | null): number {
  const parts = path && state.root ? relativeParts(state.root, path) : null;
  return parts && parts.length > 1 ? lineOf.get(key(parts[0])) ?? 1 : 1;
}

/** Restores the folders the reader had open in this root; by default every top-level folder is open. */
export function restoreExpanded() {
  const saved = state.root ? store.json<string[] | null>(`expanded:${key(state.root)}`, null) : null;
  expanded = new Set(saved ?? state.tree.filter((n) => n.children).map((n) => key(n.path)));
}

function saveExpanded() {
  if (state.root) store.setJson(`expanded:${key(state.root)}`, [...expanded]);
}

export function expandTo(path: string) {
  const parts = state.root ? relativeParts(state.root, path) : null;
  if (!parts) return;
  let acc = state.root!;
  for (const p of parts.slice(0, -1)) expanded.add(key((acc = joinPath(acc, p))));
  saveExpanded();
}

/* ---------------- rendering ---------------- */
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

function collectRows(nodes: TreeNode[], depth: number, line: number, q: string, out: Row[]) {
  for (const n of nodes) {
    const l = depth > 0 ? line : n.children ? lineOf.get(key(n.name)) ?? 1 : 1;
    out.push({ node: n, depth, line: l });
    if (n.children && isOpen(n, q)) collectRows(n.children, depth + 1, l, q, out);
  }
}

function highlight(name: string, q: string): string {
  const i = q ? name.toLowerCase().indexOf(q) : -1;
  if (i < 0) return escapeHtml(name);
  return escapeHtml(name.slice(0, i)) + "<mark>" + escapeHtml(name.slice(i, i + q.length)) + "</mark>" + escapeHtml(name.slice(i + q.length));
}

// The line runs down the left edge of each top-level folder; files deeper down sit beside it,
// and the open file is joined to it by a branch.
const TRUNK_X = 20;
const indent = (depth: number) => 12 + depth * 16;

function rowHtml({ node, depth, line }: Row, index: number, q: string): string {
  const isDir = !!node.children;
  const attrs = `role="treeitem" aria-level="${depth + 1}" tabindex="${index === focusIndex ? 0 : -1}" data-i="${index}"`;
  const trunk = isDir && depth === 0 ? "" : '<span class="trunk"></span>';
  if (isDir) {
    const open = isOpen(node, q);
    const symbol = depth === 0 ? '<span class="badge"></span>' : "";
    return `<div class="row dir l${line}${open ? " open" : ""}" ${attrs} aria-expanded="${open}" style="padding-left:${indent(depth)}px">${trunk}<span class="chev">${svg("chevron", 14, 2)}</span>${symbol}<span class="nm">${escapeHtml(node.name)}</span></div>`;
  }
  const active = state.current !== null && samePath(node.path, state.current);
  const stopX = indent(Math.max(depth - 1, 0)) + 8;
  const branch = active && stopX > TRUNK_X ? `<span class="branch" style="width:${stopX - TRUNK_X}px"></span>` : "";
  return `<div class="row file l${line}${active ? " active" : ""}" ${attrs} aria-selected="${active}" title="${escapeHtml(node.name)}" style="padding-left:${indent(Math.max(depth, 1)) + 6}px">${trunk}${branch}<span class="stop" style="left:${stopX}px"></span><span class="nm">${highlight(stripExt(node.name), q)}</span></div>`;
}

export function renderTree() {
  el.filterBox.hidden = !state.root;
  el.rootName.classList.toggle("muted", !state.root);
  if (!state.root) {
    el.tree.innerHTML = "";
    el.sideFoot.textContent = "";
    return;
  }
  const q = query();
  rows = [];
  collectRows(q ? filterTree(state.tree, q) : state.tree, 0, 1, q, rows);
  if (focusIndex >= rows.length) focusIndex = rows.length - 1;
  if (focusIndex < 0) focusIndex = Math.max(0, rows.findIndex((r) => state.current && samePath(r.node.path, state.current)));
  el.tree.innerHTML = rows.length
    ? rows.map((r, i) => rowHtml(r, i, q)).join("")
    : `<div class="tree-empty">${q ? "No file names match this filter." : "No Markdown files in this folder."}</div>`;
  el.sideFoot.innerHTML = `<span>${fileCount} document${fileCount === 1 ? "" : "s"}</span><span>Other files hidden</span>`;
}

export function revealActive() {
  el.tree.querySelector(".row.active")?.scrollIntoView({ block: "nearest" });
}

/** Breadcrumb from the root to the open file, drawn as stops on the file's line. */
export function renderRoute() {
  if (!state.root) {
    el.route.innerHTML = "";
    return;
  }
  const line = lineFor(state.current);
  const parts = state.current ? relativeParts(state.root, state.current) ?? [] : [];
  const stops = [{ label: basename(state.root), cls: "", line: 1 }];
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    stops.push({ label: last ? stripExt(p) : p, cls: last ? "cur" : "", line: parts.length > 1 ? line : 1 });
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

/* ---------------- interaction ---------------- */
function activateRow(i: number) {
  const row = rows[i];
  if (!row) return;
  focusIndex = i;
  if (!row.node.children) return onOpen(row.node.path);
  const k = key(row.node.path);
  if (!expanded.delete(k)) expanded.add(k);
  saveExpanded();
  renderTree();
  focusRow(i);
}

function focusRow(i: number) {
  focusIndex = Math.max(0, Math.min(i, rows.length - 1));
  el.tree.querySelectorAll<HTMLElement>(".row").forEach((r) => (r.tabIndex = -1));
  const target = el.tree.querySelector<HTMLElement>(`.row[data-i="${focusIndex}"]`);
  if (target) {
    target.tabIndex = 0;
    target.focus();
  }
}

function onTreeKey(e: KeyboardEvent) {
  // Alt+Left/Right belong to history; leave modified keys to the window.
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const i = focusIndex;
  const row = rows[i];
  if (!row) return;
  const isDir = !!row.node.children;
  const openDir = isDir && isOpen(row.node, query());
  switch (e.key) {
    case "ArrowDown": focusRow(i + 1); break;
    case "ArrowUp": focusRow(i - 1); break;
    case "Home": focusRow(0); break;
    case "End": focusRow(rows.length - 1); break;
    case "ArrowRight":
      if (openDir) focusRow(i + 1);
      else if (isDir) activateRow(i);
      break;
    case "ArrowLeft":
      if (openDir) activateRow(i);
      else for (let j = i - 1; j >= 0; j--) if (rows[j].depth < row.depth) { focusRow(j); break; }
      break;
    case "Enter":
    case " ":
      activateRow(i);
      break;
    default:
      return;
  }
  e.preventDefault();
}

function onFilterKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    el.filter.value = "";
    renderTree();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    focusRow(0);
  } else if (e.key === "Enter") {
    const first = rows.find((r) => !r.node.children);
    if (first) onOpen(first.node.path);
  }
}

export function focusFilter() {
  el.filter.focus();
  el.filter.select();
}

export function clearFilter() {
  el.filter.value = "";
}

export function initTree(open: (path: string) => void) {
  onOpen = open;
  el.filterIcon.innerHTML = svg("search", 14);
  el.tree.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(".row[data-i]");
    if (row) activateRow(Number(row.dataset.i));
  });
  el.tree.addEventListener("keydown", onTreeKey);
  el.filter.addEventListener("input", () => {
    focusIndex = 0;
    renderTree();
  });
  el.filter.addEventListener("keydown", onFilterKey);
}
