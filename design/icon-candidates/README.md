# Metrodown icon candidates

Status: candidate 05 (Blue Cutout) selected by the user on 2026-10-11 for implementation and release v0.2.2. This directory preserves the original comparison; its preview captions reflect the pre-selection stage. Production assets are under src-tauri/.
Verified against repository HEAD f125323c0e33fbf311b987131fb75a19a1c86005 on 2026-10-11.

## Brief

The user requested ten newly designed icon candidates that communicate a document app and improve visibility on light backgrounds. Each candidate provides an app tile and a transparent document icon. The designs use simple editable vector geometry, flat surfaces and paper silhouettes. Candidate 03 carries forward the existing blue/green transit identity; the others explore document identification, reading and small-size visibility. These are alternatives, not an approved change to DESIGN.md or the application palette.

## Compare

Open index.html locally. It has ten candidates, four preview backgrounds, a detail dialog, illustrative Explorer rows and SVG downloads. comparison.png is a single-board overview; comparison.svg is its vector source. The numbered PNGs are exported at 16, 24, 32, 48 and 256 pixels with transparent backgrounds. The overview scales its display samples when the overview image is resized; use index.html at 100% browser zoom for CSS-size comparison. Assets are original hand-authored SVG, rasterized with sharp; no generated raster source or external assets.

## Implementation after selection

The current source is src-tauri/app-icon.svg, but Tauri bundles the generated assets under src-tauri/icons. Windows hooks.nsh currently points the Markdown ProgID DefaultIcon to metrodown.exe,0. Applying a separate file icon requires packaging that ICO and updating its registration and uninstall cleanup. App icon replacement must regenerate every configured size, ICO and ICNS. Refresh and verify actual Windows Explorer/taskbar display after installation. Current candidates have not been installed, and Windows icon cache behavior has not been tested.

## Review checklist

- [x] Ten distinct candidate families, each with app and document variants.
- [x] Editable SVG plus PNG sizes for comparison.
- [x] Light-first backgrounds; darker ink and explicit paper silhouette.
- [x] User selected 05; production ICO files include dedicated 16/24px drawings.
- [ ] Build, install, association and Explorer verification after selection.

## Knowledge capture review

No PKB record added: this is unselected design exploration. The current source/association observations and candidate status are preserved here; no new durable preference is inferred from candidate designs.

## Validation

Static validation passed for all 20 unique SVGs, 100 PNG dimensions and alpha channels, static HTML asset references, JavaScript parsing and all ten candidate entries. Primary ink on white ranges from 4.8:1 to 9.27:1. These ratios do not certify icon semantics. The comparison board was visually inspected. Browser interaction and responsive rendering remain unverified because local-file navigation was denied by browser policy; no bypass was attempted. See validation.json for the bounded checks.
