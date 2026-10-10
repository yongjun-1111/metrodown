import { describe, expect, it } from "vitest";
import { renderMarkdown, slugify } from "./render";
import { parseFrontMatter, splitFrontMatter } from "./frontmatter";
import { dirname, relativeParts, resolvePath } from "./paths";

describe("renderMarkdown", () => {
  it("renders GFM tables, strikethrough and links", () => {
    const { html } = renderMarkdown("| a | b |\n|---|--:|\n| 1 | 2 |\n\n~~old~~ see https://example.com");
    expect(html).toContain("<table>");
    expect(html).toContain('style="text-align:right"');
    expect(html).toContain("<s>old</s>");
    expect(html).toContain('<a href="https://example.com">');
  });

  it("turns task list markers into read-only check marks", () => {
    const { html } = renderMarkdown("- [x] done\n- [ ] todo\n- plain");
    expect(html).toContain('<ul class="tasks">');
    expect(html).toContain('<li class="task done"><span class="cb" aria-label="Done">');
    expect(html).toContain('<li class="task"><span class="cb" aria-label="Not done"></span>todo');
    expect(html).toContain("<li>plain</li>");
    expect(html).not.toContain("[x]");
  });

  it("renders GitHub alerts with their title and keeps the body", () => {
    const { html } = renderMarkdown("> [!WARNING]\n> Mind the gap.");
    expect(html).toContain('<div class="alert alert-warning">');
    expect(html).toContain('<p class="alert-title">Warning</p>');
    expect(html).toContain("Mind the gap.");
    expect(html).not.toContain("[!WARNING]");
  });

  it("leaves ordinary blockquotes alone", () => {
    const { html } = renderMarkdown("> just a quote");
    expect(html).toContain("<blockquote>");
  });

  it("highlights known languages and escapes unknown ones", () => {
    const rust = renderMarkdown("```rust\nfn main() {}\n```").html;
    expect(rust).toContain('<pre data-lang="rust"><code class="hljs">');
    expect(rust).toContain('<span class="hljs-keyword">fn</span>');
    const other = renderMarkdown("```nope\n<b>x</b>\n```").html;
    expect(other).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("gives headings GitHub-style unique ids and lists them", () => {
    const { html, headings } = renderMarkdown("# Title\n## Goals & non-goals\n## Goals & non-goals\n### `code` step");
    expect(html).toContain('<h2 id="goals--non-goals">');
    expect(html).toContain('<h2 id="goals--non-goals-1">');
    expect(headings.map((h) => h.id)).toEqual(["title", "goals--non-goals", "goals--non-goals-1", "code-step"]);
    expect(headings[3].level).toBe(3);
  });

  it("keeps Korean text in slugs", () => {
    expect(slugify("설치 방법!")).toBe("설치-방법");
  });

  it("strips front matter from the body and reports it", () => {
    const r = renderMarkdown("---\nstatus: Draft\ntags: [a, b]\n---\n# Doc");
    expect(r.meta).toEqual({ status: "Draft", tags: ["a", "b"] });
    expect(r.html.startsWith("<h1")).toBe(true);
  });
});

describe("front matter", () => {
  it("parses block lists and quotes", () => {
    expect(parseFrontMatter("owner: 'agent'\nlinks:\n  - one\n  - \"two\"")).toEqual({ owner: "agent", links: ["one", "two"] });
  });
  it("ignores documents without front matter", () => {
    expect(splitFrontMatter("# no").meta).toBeNull();
  });
});

describe("paths", () => {
  it("resolves relative, parent and root-relative links", () => {
    expect(resolvePath("D:\\repo\\docs", "adr/0001.md")).toBe("D:\\repo\\docs\\adr\\0001.md");
    expect(resolvePath("D:\\repo\\docs", "../README.md")).toBe("D:\\repo\\README.md");
    expect(resolvePath("D:\\repo\\docs", "/tickets/a%20b.md", "D:\\repo")).toBe("D:\\repo\\tickets\\a b.md");
    expect(resolvePath("D:\\repo", "..\\..\\..\\x.md")).toBe("D:\\x.md");
  });
  it("finds parents and relative parts", () => {
    expect(dirname("C:\\a.md")).toBe("C:\\");
    expect(dirname("D:\\repo\\docs\\a.md")).toBe("D:\\repo\\docs");
    expect(relativeParts("D:\\Repo", "d:\\repo\\docs\\a.md")).toEqual(["docs", "a.md"]);
    expect(relativeParts("D:\\repo", "D:\\repository\\a.md")).toBeNull();
  });
});
