# md-viewer specification

Status: approved for implementation (2026-10-10). Design: direction A "line map", see
`.impeccable/surfaces/src-index-html.md` and `design/mockups/index.html`.

## Objective

A read-only Markdown viewer for Windows 11. Open a folder, browse its Markdown files in a
left-side tree, read the selected file rendered with Markdown Preview Enhanced (MPE)-level
readability. Native, small and fast.

## Non-goals

Editing or saving, sync, plugins, export, macOS/Linux builds, footnotes and KaTeX math in v1
(kept as follow-ups).

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Shell | Tauri 2, Rust backend, system WebView2 | User choice; small binary, fast start, web rendering |
| Frontend | Vanilla TypeScript + Vite, no UI framework | Smallest bundle and fastest start for one screen |
| Parser | markdown-it with in-house task-list, front-matter and GitHub alert rules | Same parser family as MPE |
| Highlighting | highlight.js core with a curated language set | Keeps bundle small |
| Raw HTML | Allowed, sanitized with DOMPurify | Documents can embed HTML; scripts must never reach Tauri IPC |
| Filesystem | Backend exposes read-only commands only | "Never modify the user's files" |
| Window | Custom title bar (decorations off), drag regions, native min/max/close behaviour | The sign band carries the route breadcrumb |
| Persistence | `localStorage` in the WebView: last root, expanded folders, theme, last-read position per file | No config files to manage |

## Behaviour

1. Open a folder with the title-bar button, `Ctrl+O`, or by dropping a folder on the window.
   The last opened folder reopens on start.
2. The tree shows only `.md` / `.markdown` files. Folders with no Markdown below them are
   hidden. `.git`, `node_modules`, `target`, `dist`, `.venv` and similar are never scanned.
3. Each top-level folder gets a line colour (the first colour is reserved for root-level files),
   shown as a coloured symbol without a number. The line runs down the folder's left edge only;
   files deeper down sit beside it, and the open file is joined to it by a horizontal branch and
   drawn as the "transfer station". The Open folder button sits at the right end of the folder
   name row.
4. The filter field narrows the tree by file name (case-insensitive), keeping parent folders.
5. The document pane renders GFM: headings with anchors, tables, task lists (read-only),
   strikethrough, GitHub alerts (`> [!NOTE]` etc.), highlighted code, images with
   paths relative to the document, YAML front matter shown as the meta row (status, updated)
   plus a collapsible table when it has other keys. Text diagrams in code blocks keep their
   columns (wide characters such as Hangul take two) and their box-drawing lines join; ```mermaid
   blocks are drawn as diagrams, loading the Mermaid library only for documents that have one.
6. Relative links to other Markdown files open in the viewer; `Alt+Left` / `Alt+Right` move
   through history. External links open in the default browser. `#anchor` links scroll.
   A link to a Markdown file outside the open folder opens that file's project (nearest
   folder with `.git`, else its folder), so the tree, route and watcher always cover it.
7. The outline lists h2/h3 headings when there are at least two (one stop is no route, so the
   column goes back to the document); sections already passed are solid, the current one is
   a ring, sections ahead are dashed. Clicking a stop scrolls to it.
8. (Removed 2026-10-10: the progress line repeated what the outline route already shows.)
9. Reopening a file restores its last scroll position. When the position comes from an earlier
   session, that section is flagged "Last read here"; switching between files in one sitting
   restores silently.
10. The open file reloads when it changes on disk, keeping the scroll position.
11. Theme follows Windows light/dark; a title-bar toggle overrides it.
12. The installer registers `.md` / `.markdown` with Windows ("Open with", or the default app
    once the user picks it). Opening a file from Explorer or a terminal while the viewer runs
    hands it to the existing window (single instance) instead of starting a second one; Back
    returns to what was open before.

## Performance budget

| Metric | Budget |
|---|---|
| Release installer (NSIS) | under 8 MB |
| Cold start to first paint | under 400 ms |
| Open a 1 MB Markdown file | under 150 ms |
| Scan a 5,000-file folder | under 500 ms, off the UI thread |

## Acceptance

- [ ] `npm run tauri build` produces a release exe and installer.
- [ ] Opening `D:\repos\md-viewer` shows only Markdown files, grouped by line colour.
- [ ] Every rendering feature in Behaviour 5 displays correctly on a fixture document.
- [ ] Link navigation, history, outline tracking and last-read flag work.
- [ ] Editing a file on disk updates the open document.
- [ ] No backend command can write, rename or delete files.
- [ ] Rust unit tests cover tree filtering; frontend tests cover the Markdown renderer setup.

## Tickets (local tracker)

1. Scaffold Tauri 2 + Vite + TS app, custom title bar, window state. (blocks all)
2. Backend: `scan_tree`, `read_file`, file watch events, tests. (after 1)
3. Renderer: markdown-it pipeline, sanitizer, highlighting, front matter, alerts, fixture. (after 1)
4. Shell UI: line-map tree, filter, route breadcrumb, theme. (after 2)
5. Reading UI: outline route, progress, last-read flag, link navigation and history. (after 3, 4)
6. Packaging and performance check against the budget. (after 5)
