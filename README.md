# Metrodown

A lightweight, read-only Markdown viewer for Windows and macOS.

- Native desktop app (Tauri 2 + WebView2), built to start fast and stay small.
- Left-side directory explorer for browsing a folder's Markdown files.
- Rendering modeled on VS Code's Markdown Preview Enhanced: GitHub-flavored Markdown,
  syntax-highlighted code, tables, task lists and a table of contents.
- No editing. The viewer never modifies your files.

## Opening files from Explorer

The installer registers `.md` and `.markdown` and offers to make Metrodown the default app: it
opens Settings on Metrodown's Default apps page, where "Set default" finishes it (Windows lets
only the user change a default). Later, right-click a `.md` file, then Open with, Choose another
app, Metrodown, Always. A file opened while the viewer is running goes to the existing window.
From a terminal: `metrodown.exe path\to\file.md`.

## macOS

Download the `.dmg` from the latest Release. The app is unsigned (Apple silicon only): the
first time, right-click Metrodown.app → Open, or allow it in System Settings → Privacy &
Security. To make it the default for Markdown, Finder → a `.md` file → Get Info → Open with →
Metrodown → Change All.

## Releases

Each Release carries the Windows installer and the macOS `.dmg`, both built by the
**Release** GitHub Actions workflow. To publish one, raise `version` in `package.json`,
`src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, commit, then tag and push:

```powershell
git tag v0.2.0
git push origin v0.2.0
```

Running the workflow by hand from the Actions tab builds both without publishing; the files
are attached to the run as artifacts.

## Build

Requires Node 20.19+ (or 22.12+), the Rust toolchain and the Windows SDK. From PowerShell:

```powershell
npm install
npm test                 # renderer and path unit tests
npm run tauri build      # installer: src-tauri/target/release/bundle/nsis/
```

`npm run tauri dev` runs the app against the Vite dev server.

## Icons

The app uses the Blue Cutout document design (candidate 05, selected 2026-10-11).
The app tile has a pale blue background; associated Markdown files use a separate,
transparent paper silhouette. The title bar uses the same mark.

Run `npm run icons` after changing `src-tauri/app-icon.svg`, `document-icon.svg`, or
their `-small.svg` variants. It regenerates all bundled PNG/ICO/ICNS assets using
the installed Tauri CLI. The Windows ICO files carry 16, 24, 32, 48, 64 and 256px
frames; 16/24px use the larger, heavier small drawing. No image-generation API or
additional image dependency is required. Generated scratch files stay under the
ignored `src-tauri/target/` directory and are removed after the command.

Windows packages `document.ico` as a resource and points all Metrodown Markdown
association entries at it. Tauri removes the resource on uninstall. macOS packages
`document.icns`; `src-tauri/Info.plist` supplies the document-icon association, which
the release workflow checks in the built app bundle. Existing defaults and the
read-only Viewer role are preserved.

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
