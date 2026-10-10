---
name: md-viewer
description: A read-only Markdown viewer where every top-level folder is a transit line.
colors:
  line-1: "#0052a4"
  line-2: "#00a84d"
  line-3: "#ef7c1c"
  line-4: "#00a5de"
  line-5: "#996cac"
  line-6: "#cd7c2f"
  line-7: "#747f00"
  line-8: "#e6186c"
  line-9: "#bdb092"
  sign-navy: "#172030"
  sign-ink: "#f3f5f9"
  sign-ink-muted: "#9eabc0"
  reading-ground: "#ffffff"
  panel-grey: "#f3f5f8"
  ink: "#1c222b"
  ink-secondary: "#4f5a68"
  ink-tertiary: "#6f7987"
  rule: "#dfe4ea"
  rule-strong: "#c3cad4"
  code-ground: "#f4f6f9"
  link-blue: "#0a5bd3"
  alert-note: "#0969da"
  alert-tip: "#1a7f37"
  alert-important: "#8250df"
  alert-warning: "#9a6700"
  alert-caution: "#cf222e"
typography:
  display:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, system-ui, sans-serif"
    fontSize: "2.05rem"
    fontWeight: 650
    lineHeight: 1.22
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, system-ui, sans-serif"
    fontSize: "1.38rem"
    fontWeight: 630
    lineHeight: 1.3
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, system-ui, sans-serif"
    fontSize: "1.14rem"
    fontWeight: 630
    lineHeight: 1.35
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.72
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, Malgun Gothic, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 620
  code:
    fontFamily: "Cascadia Code, Cascadia Mono, Consolas, D2Coding, Malgun Gothic, monospace"
    fontSize: "13.5px"
    lineHeight: 1.65
    fontFeature: "\"liga\" 0, \"calt\" 0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  full: "50%"
spacing:
  tree-indent: "16px"
  tree-row: "29px"
  panel-gutter: "14px"
  doc-top: "44px"
  doc-side: "56px"
components:
  button-primary:
    backgroundColor: "{colors.sign-navy}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-icon:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    size: "28px"
  input-filter:
    backgroundColor: "{colors.reading-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  tree-row:
    textColor: "{colors.ink}"
    height: "{spacing.tree-row}"
  line-symbol:
    backgroundColor: "{colors.line-2}"
    rounded: "{rounded.full}"
    size: "12px"
  code-block:
    backgroundColor: "{colors.code-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
---

# Design System: md-viewer

## Overview

**Creative North Star: "The Line Map"**

md-viewer reads a repository the way a rider reads a metro map. Every top-level folder is a line with a colour; every Markdown file is a station; the open file is the transfer station. The tree, the title-bar route and the outline speak this one language, so the reader always knows which line they are on, which stop they are at, and how much of the document is behind them.

Around that map sits a calm reading column modelled on GitHub-style Markdown: a white ground, a 46rem measure, generous line height, and no decoration inside the text that the document did not ask for. The chrome is dense and quiet; the column is open and slow. The look refuses the category default of a grey editor explorer beside an anonymous preview.

The app is Windows-native in feel: Segoe UI Variable throughout, Cascadia Code for code, a custom 42px title bar drawn as a dark navy sign band, and Windows caption buttons.

**Key Characteristics:**
- Nine Seoul-metro line colours, one per top-level folder, shown as plain coloured symbols; the first colour belongs to files at the root.
- Line form carries state: solid behind the reader, dashed ahead, a white ring for "you are here".
- A dark navy sign band above a cool grey panel and a white reading ground.
- Flat surfaces; depth comes from tone and rules, never shadows.
- Light and dark themes with a brighter twin for every line colour.

## Colors

A neutral, cool-grey world in which the only saturated colours are the transit lines and the GitHub alert set.

### Primary
- **The nine line colours** (line-1 to line-9): territory markers. Each top-level folder takes the next line in order (2 to 9, then wrapping); root-level files are line 1. A line colour appears in the folder's 12px symbol, its 2px trunk line, its file stops, the branch to the open file, the route segments, the outline's solid track and the done task checkboxes. Lines carry no numbers: the order of colours is internal. In the dark theme each has a brighter twin (for example line 1 becomes #4c8dff) and its ink flips to near-black.

### Neutral
- **Sign Navy** (sign-navy): the title-bar sign band; in dark theme it deepens to #080b0f. Also the light theme's primary button.
- **Sign Ink / Muted Sign Ink** (sign-ink, sign-ink-muted): text and icons on the sign band; muted for the route's passed stops and the title-bar buttons at rest.
- **Panel Grey** (panel-grey): the sidebar ground, so the tree reads as a separate map from the page.
- **Reading Ground** (reading-ground): the document column and the outline; #0e1217 in dark.
- **Ink, Secondary Ink, Tertiary Ink** (ink, ink-secondary, ink-tertiary): body text; meta row and blockquotes; labels, counts, list markers and the dashed outline track.
- **Rules** (rule, rule-strong): borders, table cells, h2 underlines; the stronger rule draws the dashed outline track and blockquote edge.
- **Code Ground** (code-ground): inline code and code blocks.
- **Link Blue** (link-blue): underlined document links and the focus ring.

### Secondary
- **The alert set** (alert-note, alert-tip, alert-important, alert-warning, alert-caution): GitHub's alert colours, used only for alert icons, titles and a 9% tinted ground.

### Named Rules
**The Territory Rule.** A line colour says where a file lives, never what state it is in. State is carried by form (solid, dashed, ring), so a reader can tell "read" from "ahead" without telling green from orange.

**The Two Voices Rule.** Inside the reading column, the only colours are link blue, the alert set and syntax highlighting. Line colour enters the column only through the meta-row symbol and done checkboxes.

## Typography

**Display Font:** Segoe UI Variable Text (with Segoe UI, Malgun Gothic, system-ui)
**Body Font:** the same family
**Label/Mono Font:** Cascadia Code (with Cascadia Mono, Consolas, D2Coding)

**Character:** One Windows-native sans for chrome and prose, so the app feels like part of the system; a programmer's mono with ligatures switched off, so code reads exactly as typed. Malgun Gothic and D2Coding cover Korean text.

### Hierarchy
- **Display** (650, 2.05rem, 1.22): the document h1 only.
- **Headline** (630, 1.38rem, 1.3): h2, with a 1px rule beneath; these become outline stops.
- **Title** (630, 1.14rem, 1.35): h3, the outline's sub-stops. h4 is 1rem; h5 and h6 are 0.92rem in secondary ink.
- **Body** (400, 16px, 1.72): document prose at a 46rem measure.
- **Label** (620, 12px): "On this page", "Recent folders", footer counts. Chrome text is 12.5px to 13.5px; tree rows are 13.5px, folders at 600.
- **Code** (13.5px, 1.65): code blocks; inline code is 0.86em with a code-ground pill.

### Named Rules
**The As-Typed Rule.** Code never uses ligatures or contextual alternates; `!=` stays two characters.

## Layout

A three-column window under a 42px sign band (ring logo, route breadcrumb, theme toggle, caption buttons): a resizable sidebar (284px default, 200px to 520px), a flexible document pane, and a 248px outline. The outline column disappears when a document has fewer than two outline stops and below 1100px window width; below 720px the sidebar goes too, leaving the document alone (the window can narrow to 400px). The document pane scrolls on its own with 44px top, 56px side and 120px bottom padding (32px / 28px / 96px below 900px, 24px / 18px / 80px below 520px); its content is a centred 46rem column. Tree rows are 29px tall; each depth has its own symbol column, 18px apart, starting at x = 40px (the top-level symbol's centre), with names 12px after it. Spacing follows the reading column's rem rhythm inside documents (paragraph gap 1.05rem, h2 top margin 2.7rem) and fixed pixels in the chrome.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth comes from three tonal planes: the dark sign band, the grey panel, and the white reading ground, separated by 1px rules. Hover is a tonal fill, focus is a 2px link-blue outline inset by 2px.

### Named Rules
**The Flat Map Rule.** A metro map is printed, not lifted. Nothing casts a shadow; if something needs to stand out, give it tone or a ring.

## Shapes

Gently rounded rectangles for controls and blocks (6px for buttons, inputs and title-bar buttons; 8px for code blocks and alerts; 4px to 5px for images, keyboard keys and inline code). Everything that belongs to the map is a circle: line symbols (12px), station dots (10px hollow, 2px line border), the transfer ring (15px, 3.5px border, white centre), route dots and outline stops. Lines are straight 2px to 3px strokes with rounded ends.

## Components

### Buttons
- **Shape:** gently rounded (6px).
- **Primary:** Sign Navy with Sign Ink, 36px tall, 16px side padding, 14px/600 with a leading 16px icon; in dark theme the ground lifts to #263247. Used for the empty-state "Open folder".
- **Sign buttons:** icon buttons on the sign band (the theme toggle), Muted Sign Ink at rest, a 9% white fill and full Sign Ink on hover (0.15s).
- **Sidebar icon button:** the Open folder button, a 28px icon button at the right end of the folder name row; secondary ink at rest, the hover fill on hover.
- **Caption buttons:** 46px wide Windows controls; close turns #c42b1c on hover.

### Inputs / Fields
- **Filter:** 32px field on the reading ground with a 1px rule border, 6px radius, a 14px search icon; the border turns link blue on focus. Hidden until a folder is open.

### Navigation
- **Line-map tree:** top-level folders show a chevron and a 12px line symbol; nested folders show a chevron in their depth's column. One 2px trunk drops from each top-level folder's symbol; nested folders add no lines of their own. Files show a hollow station dot in their depth's column, so a folder's files sit one step right of root-level files, which share the top-level symbols' column and are joined only by their own line-1 segment between their dots. The open file gets a horizontal branch from the trunk to its dot, a 13% line-colour wash, 620 weight and the white transfer ring. Filter matches are marked with a 28% line-colour highlight.
- **Route breadcrumb:** in the sign band, root dot, 30px line segments in the file's line colour, folder stops, and the current file as a white-centred ring on its line with its name in Sign Ink; long paths collapse to root, "…", and the last three stops.

### Outline route (signature)
A vertical route of stops for h2 and h3: the track is dashed in strong rule colour ahead of the reader and solid line colour behind; passed stops fill with the line colour; the current stop is a 14px transfer ring and its label turns ink at 620. h3 stops are smaller and indented. A "Last read here · 3 days ago" flag with a bookmark icon sits under the stop where the reader left off in an earlier session.

### Meta row
Above the h1, a meta row shows the line symbol and folder name, front-matter status in line colour, the updated date and the read time, separated by 3px dots; remaining front-matter keys sit in a collapsible table below it.

### Alerts
GitHub alerts (note, tip, important, warning, caution) as 8px-rounded blocks on a 9% tint of their colour, an 18px icon, and a coloured title. No border.

### Code blocks
Code ground, 1px rule border, 8px radius, 16px by 18px padding, with the language label in tertiary ink at the top right. Syntax colours follow GitHub's light and dark palettes.

### Diagrams
Text diagrams (code blocks with box-drawing characters) tighten to a 1.16 line height so vertical lines join, and every wide character fills exactly two columns. Mermaid blocks become a figure with a 1px rule border and 8px radius, drawn with Mermaid's base theme coloured from the app tokens: code-ground nodes, strong-rule borders, tertiary-ink edges, ink text at 15px.

## Do's and Don'ts

### Do:
- **Do** give each new top-level folder the next line colour in order and keep line 1 for root files.
- **Do** show progress and position with line form in the outline only: solid behind, dashed ahead, a white ring for the current stop.
- **Do** keep the reading column at 46rem with 16px/1.72 body text.
- **Do** pair every line colour with its dark-theme twin when adding a surface that uses it.
- **Do** keep Windows-native type: Segoe UI Variable for text, Cascadia Code for code with ligatures off.

### Don't:
- **Don't** use a line colour to signal state (unread, changed, error); use form or text.
- **Don't** add shadows or lifted cards; separate planes with tone and 1px rules.
- **Don't** bring line colour into document prose beyond the meta symbol and done checkboxes.
- **Don't** stack a guide line per nesting level in the tree; one trunk per top-level folder, and a branch for the open file.
- **Don't** put numbers on line symbols.
- **Don't** show controls that have nothing to act on, such as the filter before a folder is open.
