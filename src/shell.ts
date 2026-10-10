// Window chrome: theme, title-bar buttons, sidebar width and app-wide keys.
import { drawDiagrams } from "./diagrams";
import { appWindow, el, isMac } from "./dom";
import { svg } from "./icons";
import { saveReadPosition } from "./reader";
import { goHistory, pickFolder, reloadCurrent } from "./session";
import { store } from "./store";
import { focusFilter } from "./tree";

const MAX_ICON = '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" fill="none"><rect x=".5" y=".5" width="9" height="9" rx="1"/></svg>';
const RESTORE_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" fill="none"><rect x=".5" y="2.5" width="7" height="7" rx="1"/><path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1"/></svg>';

const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const theme = () => store.get("theme") ?? (darkQuery.matches ? "dark" : "light");

function applyTheme() {
  const t = theme();
  document.documentElement.dataset.theme = t;
  el.themeBtn.innerHTML = svg(t === "dark" ? "sun" : "moon", 16);
  el.themeBtn.title = t === "dark" ? "Switch to light theme" : "Switch to dark theme";
  void drawDiagrams();
}

async function syncMaxIcon() {
  const max = await appWindow.isMaximized();
  el.wcMax.innerHTML = max ? RESTORE_ICON : MAX_ICON;
  el.wcMax.setAttribute("aria-label", max ? "Restore" : "Maximize");
}

function initResizer() {
  const setWidth = (w: number) => document.documentElement.style.setProperty("--side-w", `${w}px`);
  let width = Number(store.get("sideWidth")) || 284;
  setWidth(width);
  el.resizer.addEventListener("pointerdown", (e) => {
    el.resizer.setPointerCapture(e.pointerId);
    el.resizer.classList.add("drag");
    const move = (ev: PointerEvent) => setWidth((width = Math.max(200, Math.min(520, ev.clientX))));
    const up = () => {
      el.resizer.classList.remove("drag");
      el.resizer.removeEventListener("pointermove", move);
      el.resizer.removeEventListener("pointerup", up);
      store.set("sideWidth", String(width));
    };
    el.resizer.addEventListener("pointermove", move);
    el.resizer.addEventListener("pointerup", up);
  });
}

function onKey(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (ctrl && k === "o") void pickFolder();
  else if (ctrl && (k === "p" || (e.shiftKey && k === "f"))) focusFilter();
  else if ((e.altKey && e.key === "ArrowLeft") || (e.metaKey && e.key === "[")) void goHistory(-1);
  else if ((e.altKey && e.key === "ArrowRight") || (e.metaKey && e.key === "]")) void goHistory(1);
  else if (e.key === "F5" || (ctrl && k === "r")) reloadCurrent();
  else return;
  e.preventDefault();
}

export function initShell() {
  applyTheme();
  darkQuery.addEventListener("change", () => {
    if (!store.get("theme")) applyTheme();
  });
  el.themeBtn.addEventListener("click", () => {
    store.set("theme", theme() === "dark" ? "light" : "dark");
    applyTheme();
  });

  if (isMac) {
    document.documentElement.dataset.os = "mac";
    el.openBtn.title = "Open folder (⌘O)";
    el.filter.setAttribute("aria-label", "Filter files (⌘P)");
  }
  el.openBtn.innerHTML = svg("folderOpen", 16);
  el.openBtn.addEventListener("click", () => void pickFolder());
  el.wcMin.addEventListener("click", () => void appWindow.minimize());
  el.wcMax.addEventListener("click", () => void appWindow.toggleMaximize());
  el.wcClose.addEventListener("click", () => {
    saveReadPosition();
    void appWindow.close();
  });
  void syncMaxIcon();
  void appWindow.onResized(() => void syncMaxIcon());
  initResizer();

  addEventListener("keydown", onKey);
  addEventListener("mouseup", (e) => {
    if (e.button === 3) void goHistory(-1);
    else if (e.button === 4) void goHistory(1);
  });
  // Keep the browser menu (Refresh, Save as…) out of the app; allow it for copying a selection.
  addEventListener("contextmenu", (e) => {
    if (!window.getSelection()?.toString()) e.preventDefault();
  });
  addEventListener("beforeunload", saveReadPosition);
}
