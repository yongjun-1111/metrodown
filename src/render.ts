import markdownit, { type MarkdownIt, type Token } from "markdown-it";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { svg, type IconName } from "./icons";
import { splitFrontMatter, type FrontMatter } from "./frontmatter";

const LANGS = { bash, cpp, csharp, css, diff, go, ini, java, javascript, json, markdown, powershell, python, rust, shell, sql, typescript, xml, yaml };
for (const [name, def] of Object.entries(LANGS)) hljs.registerLanguage(name, def);
hljs.registerAliases(["toml"], { languageName: "ini" });
hljs.registerAliases(["html", "svg", "vue"], { languageName: "xml" });
hljs.registerAliases(["ps1", "pwsh"], { languageName: "powershell" });
hljs.registerAliases(["sh", "zsh", "console"], { languageName: "bash" });

export type Heading = { level: number; text: string; id: string };
export type Rendered = { html: string; meta: FrontMatter | null; headings: Heading[]; words: number };

type Env = { headings: Heading[] };

const ALERTS: Record<string, { title: string; icon: IconName }> = {
  note: { title: "Note", icon: "info" },
  tip: { title: "Tip", icon: "tip" },
  important: { title: "Important", icon: "important" },
  warning: { title: "Warning", icon: "warning" },
  caution: { title: "Caution", icon: "caution" },
};

/** GitHub-style heading slug: lower case, punctuation removed, each space becomes a hyphen. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

// East Asian wide characters (Hangul, CJK, full-width forms, emoji) occupy two columns in
// the text editors and terminals where diagrams are drawn.
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1f300}-\u{1f64f}\u{1f900}-\u{1f9ff}\u{20000}-\u{3fffd}]/gu;
const BOX_DRAWING = /[─-╿]/;

/**
 * Puts each wide character in a two-column cell so text diagrams keep their columns whatever
 * font supplies the glyph. Safe on highlighted HTML: markup and entities are ASCII only.
 */
const gridCells = (html: string) => html.replace(WIDE, '<span class="w">$&</span>');

const md: MarkdownIt = markdownit({
  html: true,
  linkify: true,
  typographer: false,
  highlight(code, info) {
    const lang = (info || "").trim().split(/\s+/)[0].toLowerCase();
    // Rendered into a picture after sanitizing, see reader.ts; the source stays readable meanwhile.
    if (lang === "mermaid") return `<pre data-lang="mermaid" class="mermaid-src"><code>${md.utils.escapeHtml(code)}</code></pre>\n`;
    let body = md.utils.escapeHtml(code);
    if (lang && hljs.getLanguage(lang)) {
      try {
        body = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        /* keep escaped text */
      }
    }
    const label = lang ? ` data-lang="${md.utils.escapeHtml(lang)}"` : "";
    const diagram = BOX_DRAWING.test(code) ? ' class="diagram"' : "";
    return `<pre${label}${diagram}><code class="hljs">${gridCells(body)}</code></pre>\n`;
  },
});

// "- [ ] item" and "- [x] item" become read-only check marks.
md.core.ruler.after("inline", "task-lists", (state) => {
  const t = state.tokens;
  for (let i = 2; i < t.length; i++) {
    if (t[i].type !== "inline" || t[i - 1].type !== "paragraph_open" || t[i - 2].type !== "list_item_open") continue;
    const m = /^\[([ xX])\][ \t]/.exec(t[i].content);
    if (!m) continue;
    const done = m[1] !== " ";
    t[i].content = t[i].content.slice(m[0].length);
    const first = t[i].children?.[0];
    if (first?.type === "text") first.content = first.content.replace(/^\[[ xX]\][ \t]/, "");
    const box = new state.Token("html_inline", "", 0);
    box.content = `<span class="cb" aria-label="${done ? "Done" : "Not done"}">${done ? svg("check", 12, 3) : ""}</span>`;
    t[i].children?.unshift(box);
    const item = t[i - 2];
    item.attrJoin("class", done ? "task done" : "task");
    for (let j = i - 3; j >= 0; j--) {
      if ((t[j].type === "bullet_list_open" || t[j].type === "ordered_list_open") && t[j].level === item.level - 1) {
        if (!String(t[j].attrGet("class") ?? "").includes("tasks")) t[j].attrJoin("class", "tasks");
        break;
      }
    }
  }
});

// GitHub alerts: "> [!NOTE]" and friends.
md.core.ruler.after("inline", "gh-alerts", (state) => {
  const t = state.tokens;
  for (let i = 0; i < t.length - 3; i++) {
    if (t[i].type !== "blockquote_open" || t[i + 1].type !== "paragraph_open" || t[i + 2].type !== "inline") continue;
    const inline = t[i + 2];
    const m = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\r?\n|$)/i.exec(inline.content);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    inline.content = inline.content.slice(m[0].length);
    const kids = inline.children ?? [];
    if (kids[0]?.type === "text") {
      kids[0].content = kids[0].content.replace(/^\[!\w+\][ \t]*/, "");
      if (kids[0].content === "") {
        kids.shift();
        if ((kids[0] as Token | undefined)?.type === "softbreak") kids.shift();
      }
    }
    if (!inline.content.trim()) t[i + 1].hidden = t[i + 3].hidden = true;
    t[i].meta = { alert: kind };
    let depth = 0;
    for (let j = i; j < t.length; j++) {
      if (t[j].type === "blockquote_open") depth++;
      else if (t[j].type === "blockquote_close" && --depth === 0) {
        t[j].meta = { alert: kind };
        break;
      }
    }
  }
});

md.renderer.rules.blockquote_open = (tokens, idx, opts, _env, self) => {
  const kind = tokens[idx].meta?.alert as string | undefined;
  if (!kind) return self.renderToken(tokens, idx, opts);
  const a = ALERTS[kind];
  return `<div class="alert alert-${kind}">${svg(a.icon, 18)}<div class="alert-body"><p class="alert-title">${a.title}</p>\n`;
};
md.renderer.rules.blockquote_close = (tokens, idx, opts, _env, self) =>
  tokens[idx].meta?.alert ? "</div></div>\n" : self.renderToken(tokens, idx, opts);

const inlineText = (tok: Token): string =>
  (tok.children ?? []).filter((c) => c.type === "text" || c.type === "code_inline").map((c) => c.content).join("");

// Heading ids (for links and the outline) and the heading list.
md.core.ruler.push("heading-ids", (state) => {
  const env = state.env as Env;
  const used = new Set<string>();
  const t = state.tokens;
  for (let i = 0; i < t.length; i++) {
    if (t[i].type !== "heading_open") continue;
    const text = inlineText(t[i + 1]).trim();
    const base = slugify(text) || "section";
    let id = base;
    for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    t[i].attrSet("id", id);
    env.headings.push({ level: Number(t[i].tag.slice(1)), text, id });
  }
});

export function renderMarkdown(src: string): Rendered {
  const { meta, body } = splitFrontMatter(src);
  const env: Env = { headings: [] };
  const html = md.render(body, env);
  const words = body.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return { html, meta, headings: env.headings, words };
}
