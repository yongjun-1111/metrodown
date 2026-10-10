import { describe, expect, it } from "vitest";
import { renderMarkdown, slugify } from "./render";
import { parseFrontMatter, splitFrontMatter } from "./frontmatter";
import { basename, dirname, joinPath, relativeParts, resolvePath, rootOf, splitLink } from "./paths";

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

  it("keeps text diagrams on a column grid", () => {
    const html = renderMarkdown("```\n카드 ─┐\n     │\n```").html;
    expect(html).toContain('<pre class="diagram">');
    expect(html).toContain('<span class="w">카</span><span class="w">드</span> ─┐');
    expect(renderMarkdown("```\nplain\n```").html).not.toContain("diagram");
  });

  it("never pulls markup into a cell next to a combining mark", () => {
    const html = renderMarkdown("```python\nif\u3099 a < b:\n```").html;
    expect(html).not.toMatch(/<span[^>]*<span|&lt<span/);
    expect(html).toContain("&lt;");
  });

  it("keeps a joined emoji in one diagram cell", () => {
    const html = renderMarkdown("```\n│👩‍💻│🚀│👍🏽│👩‍❤️‍👩│\n```").html;
    expect(html).toContain('│<span class="w">👩‍💻</span>│<span class="w">🚀</span>│<span class="w">👍🏽</span>│<span class="w">👩‍❤️‍👩</span>│');
  });

  it("leaves Mermaid source for the reader to draw", () => {
    const html = renderMarkdown("```mermaid\ngraph LR\n  A --> B\n```").html;
    expect(html).toContain('<pre data-lang="mermaid" class="mermaid-src"><code>graph LR\n  A --&gt; B\n</code></pre>');
  });

  it("gives headings GitHub-style unique ids and lists them", () => {
    const { html, headings } = renderMarkdown("# Title\n## Goals & non-goals\n## Goals & non-goals\n### `code` step");
    expect(html).toContain('<h2 id="goals--non-goals">');
    expect(html).toContain('<h2 id="goals--non-goals-1">');
    expect(headings.map((h) => h.id)).toEqual(["title", "goals--non-goals", "goals--non-goals-1", "code-step"]);
    expect(headings[3].level).toBe(3);
  });

  it("never reuses a heading id, even when a heading text looks like a suffixed id", () => {
    const { headings } = renderMarkdown("## a\n## a\n## a-1");
    expect(headings.map((h) => h.id)).toEqual(["a", "a-1", "a-1-1"]);
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
  it("treats # as a comment only outside quotes", () => {
    expect(parseFrontMatter("status: \"Ready #1\"\nowner: agent # team\ntitle: Don't #x")).toEqual({
      status: "Ready #1",
      owner: "agent",
      title: "Don't",
    });
    expect(parseFrontMatter('status: "Ready \\" #1"\ntitle: 5 " # comment')).toEqual({ status: 'Ready " #1', title: '5 "' });
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
  it("keeps the UNC server and share when climbing with ..", () => {
    expect(resolvePath("\\\\server\\share\\docs", "../../x.md")).toBe("\\\\server\\share\\x.md");
  });
  it("decodes every percent escape in a link path", () => {
    expect(resolvePath("D:\\repo", "a%23b.md")).toBe("D:\\repo\\a#b.md");
    expect(resolvePath("D:\\repo", "100%.md")).toBe("D:\\repo\\100%.md");
  });
  it("separates the path, query and fragment of a link", () => {
    expect(splitLink("guide.md?mode=read#Set%20up")).toEqual({ path: "guide.md", hash: "Set up" });
    expect(splitLink("a%23b.md")).toEqual({ path: "a%23b.md", hash: null });
    expect(splitLink("#top")).toEqual({ path: "", hash: "top" });
    expect(splitLink("a.md#one\ntwo")).toEqual({ path: "a.md", hash: "one\ntwo" });
  });
  it("finds parents and relative parts", () => {
    expect(dirname("C:\\a.md")).toBe("C:\\");
    expect(dirname("D:\\repo\\docs\\a.md")).toBe("D:\\repo\\docs");
    expect(relativeParts("D:\\Repo", "d:\\repo\\docs\\a.md")).toEqual(["docs", "a.md"]);
    expect(relativeParts("D:\\repo", "D:\\repository\\a.md")).toBeNull();
  });

  it("handles macOS paths with forward slashes", () => {
    expect(resolvePath("/Users/me/repo/docs", "../README.md")).toBe("/Users/me/repo/README.md");
    expect(resolvePath("/Users/me/repo/docs", "/guide/a.md", "/Users/me/repo")).toBe("/Users/me/repo/guide/a.md");
    expect(resolvePath("/Users/me", "../../../x.md")).toBe("/x.md");
    expect(dirname("/Users/me/a.md")).toBe("/Users/me");
    expect(dirname("/a.md")).toBe("/");
    expect(basename("/Users/me/repo/")).toBe("repo");
    expect(rootOf("/Users/me/repo/")).toBe("/Users/me/repo");
    expect(rootOf("/")).toBe("/");
    expect(joinPath("/Users/me", "docs")).toBe("/Users/me/docs");
    expect(relativeParts("/Users/me/repo", "/Users/me/repo/docs/a.md")).toEqual(["docs", "a.md"]);
    expect(relativeParts("/", "/a.md")).toEqual(["a.md"]);
  });

  it("keeps Windows roots and joins", () => {
    expect(rootOf("D:\\")).toBe("D:\\");
    expect(rootOf("D:\\repo\\")).toBe("D:\\repo");
    expect(joinPath("D:\\", "docs")).toBe("D:\\docs");
  });
});
