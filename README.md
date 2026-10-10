# md-viewer

A lightweight, read-only Markdown viewer for Windows.

- Native desktop app (Tauri 2 + WebView2), built to start fast and stay small.
- Left-side directory explorer for browsing a folder's Markdown files.
- Rendering modeled on VS Code's Markdown Preview Enhanced: GitHub-flavored Markdown,
  syntax-highlighted code, tables, task lists and a table of contents.
- No editing. The viewer never modifies your files.

## Build

Requires Node 20.19+ (or 22.12+), the Rust toolchain and the Windows SDK. From PowerShell:

```powershell
npm install
npm test                 # renderer and path unit tests
npm run tauri build      # installer: src-tauri/target/release/bundle/nsis/
```

`npm run tauri dev` runs the app against the Vite dev server.

## Code layout

| Path | Role |
|---|---|
| `src-tauri/src/main.rs` | Read-only backend: tree scan, file read, folder watcher, launch path |
| `src/main.ts` | Wires the modules together and starts the session |
| `src/session.ts` | What is open: root, current file, history, links, file-system events |
| `src/reader.ts` | Document pane: rendering, outline route, progress, read positions |
| `src/tree.ts` | Line map: sidebar tree, filter and title-bar route |
| `src/shell.ts` | Window chrome: theme, caption buttons, sidebar width, app keys |
| `src/render.ts`, `src/frontmatter.ts` | Markdown and front matter to HTML (pure, unit-tested) |
| `src/paths.ts`, `src/store.ts`, `src/dom.ts`, `src/state.ts`, `src/icons.ts` | Shared helpers |

Product context is in [PRODUCT.md](PRODUCT.md), behaviour in [docs/spec.md](docs/spec.md), and the
visual system in [DESIGN.md](DESIGN.md). The approved mockup is
[`design/mockups/index.html`](design/mockups/index.html) (variant A).
