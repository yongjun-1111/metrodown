---
version: 1
slug: "src-index-html"
primary_target: "src/index.html"
related_targets: []
---

## Scope

Viewer shell of md-viewer (the whole app window): title bar, folder tree, document pane, outline. Visitor mode: Read (the tree and title bar are Operate-style chrome around a reading column).

## Audience and task

The repository owner reads agent-authored Markdown (specs, tickets, ADRs, reports, agent instruction files) inside git repositories under D:\repos. They skim, jump between related documents, and come back to long files later.

## Direction contract

THESIS: Every folder is a transit line. The tree, the title-bar path and the outline share one line-map language, so the reader always knows which line they are on, which stop they are at, and how much of the document is behind them. Refuses the category default of a grey VS Code explorer next to an anonymous preview.

OWN-WORLD: Seoul-metro line colours assigned per top-level folder (1 #0052A4 root files, 2 #00A84D, 3 #EF7C1C, 4 #00A5DE, 5 #996CAC, 6 #CD7C2F, 7 #747F00, 8 #E6186C, 9 #BDB092, brighter twins in dark). Dark navy sign band title bar (#172030 / #080B0F). Numbered round line badges, 2px line guides, hollow station dots for files, white transfer-station ring for the open file. Cool grey panel (#F3F5F8), white reading ground. Segoe UI Variable for everything, Cascadia Code for code.

STORY: The reader opens a repo folder, sees only Markdown laid out as lines, picks a stop, reads a calm GitHub-style column, watches the outline fill in solid behind them, and on return finds a "last read here" flag where they left off.

FIRST VIEWPORT: 42px sign band: ring logo + app name, route breadcrumb (root dot, line segments in the folder's colour, current stop as a ring), Open folder, window controls. Left 284px panel: root name, path, filter field, line-map tree, footer count. Centre: 3px reading-progress line in the folder colour, meta row (line badge, folder, front-matter status, updated, read time), h1, 46rem column. Right 248px outline: dashed-ahead / solid-behind route with stops, current stop as transfer ring, last-read flag.

FORM: Grounded candidate 3 of 7 (transit wayfinding), seed key c8fd296a. Raises kept from declined challengers: state carried by line form (solid read, dashed ahead) from the emission-line rail; the persisted "where you stopped" flag from the cutting-bench rail; colour maps territory never state, from the copy-shop zine.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Reference

Approved mockup: design/mockups/index.html (variant A).

## Additions after build

- Front-matter disclosure row under the meta row ("Front matter · N fields"), with the app's SVG chevron: the meta row shows only status and updated, and docs/spec.md Behaviour 5 asks for the remaining keys in a collapsible table.
- Theme toggle in the sign band (docs/spec.md Behaviour 11).

## Changes from user feedback (2026-10-10, after installing the first build)

- Line symbols without numbers: the root taking line 1 made folder numbers start at 2, which read as arbitrary. Colour alone identifies a line.
- Open folder moved from the sign band to the right end of the folder name row in the sidebar.
- Tree guides: one trunk per top-level folder instead of one guide per nesting level; the open file is joined to the trunk by a horizontal branch.
- Reading progress line removed: it repeated the outline route.
- Diagrams: text diagrams keep a two-column cell per wide character and a tight line height so box-drawing lines join; Mermaid blocks are drawn as figures (lazy-loaded).
