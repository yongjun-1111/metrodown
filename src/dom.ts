import { getCurrentWindow } from "@tauri-apps/api/window";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** The fixed elements of the window shell in index.html. */
export const el = {
  body: $("body"),
  route: $("route"),
  tree: $("tree"),
  filter: $<HTMLInputElement>("filter"),
  filterBox: $("filterBox"),
  filterIcon: $("filterIcon"),
  rootName: $("rootName"),
  rootPath: $("rootPath"),
  sideFoot: $("sideFoot"),
  doc: $("doc"),
  scroll: $("docScroll"),
  toc: $("toc"),
  progress: $("progress"),
  themeBtn: $("themeBtn"),
  openBtn: $("openBtn"),
  wcMin: $("wcMin"),
  wcMax: $("wcMax"),
  wcClose: $("wcClose"),
  resizer: $("resizer"),
};

export const appWindow = getCurrentWindow();

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
