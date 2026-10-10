// Mermaid diagrams, drawn after a document is shown. The library loads only for documents
// that have one, so it costs nothing at start-up.
import type { Mermaid } from "mermaid";
import { el } from "./dom";

let mermaid: Promise<Mermaid> | null = null;
let seq = 0;
let drawGen = 0; // a newer draw (theme change, next document) supersedes one still rendering

/** Draws every Mermaid block in the document, or redraws them after a theme change. */
export async function drawDiagrams() {
  const gen = ++drawGen;
  const blocks = [...el.doc.querySelectorAll<HTMLElement>("pre.mermaid-src, figure.mermaid")];
  if (!blocks.length) return;
  const m = await (mermaid ??= import("mermaid").then((mod) => mod.default));
  if (gen !== drawGen) return;
  // Mermaid's base theme, coloured from the app's own tokens so diagrams follow light and dark.
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  m.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    theme: "base",
    fontFamily: css.getPropertyValue("--ui"),
    themeVariables: {
      darkMode: document.documentElement.dataset.theme === "dark",
      background: token("--bg"),
      fontSize: "15px",
      primaryColor: token("--code-bg"),
      primaryTextColor: token("--ink"),
      primaryBorderColor: token("--rule-2"),
      secondaryColor: token("--panel"),
      tertiaryColor: token("--th-bg"),
      lineColor: token("--ink-3"),
      textColor: token("--ink"),
      edgeLabelBackground: token("--bg"),
    },
  });
  for (const block of blocks) {
    const source = block.dataset.source ?? block.textContent ?? "";
    try {
      const { svg } = await m.render(`mermaid-${++seq}`, source);
      if (gen !== drawGen) return;
      const figure = document.createElement("figure");
      figure.className = "mermaid";
      figure.dataset.source = source;
      figure.innerHTML = svg;
      block.replaceWith(figure);
    } catch {
      if (gen !== drawGen) return;
      // Invalid diagrams stay as readable source, labelled so they do not look like a code sample.
      block.classList.add("mermaid-error");
    }
  }
  el.doc.dispatchEvent(new Event("layoutchange"));
}
