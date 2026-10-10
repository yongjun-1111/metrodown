export type FrontMatter = Record<string, string | string[]>;

function unquote(raw: string): string {
  const s = raw.trim();
  if (/^".*"$/.test(s)) return s.slice(1, -1).replace(/\\(["\\])/g, "$1");
  if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

/** Drops a trailing "# comment". Only a value that starts with a quote is a quoted string. */
function stripComment(line: string): string {
  const open = /^\s*(?:-\s+|[A-Za-z0-9_.-]+\s*:\s*)(["'])/.exec(line);
  let from = 0;
  if (open) {
    const q = open[1];
    let i = open[0].length;
    for (; i < line.length; i++) {
      if (q === '"' && line[i] === "\\") i++;
      else if (line[i] === q && !(q === "'" && line[i + 1] === "'")) break;
      else if (line[i] === q) i++;
    }
    from = i + 1;
  }
  const comment = /\s#/.exec(line.slice(from));
  return comment ? line.slice(0, from + comment.index) : line;
}

/**
 * Reads flat YAML front matter (`key: value`, inline `[a, b]` lists and `- item` lists).
 * Nested structures are flattened; this is for display only, never for writing back.
 */
export function parseFrontMatter(yaml: string): FrontMatter {
  const out: FrontMatter = {};
  let last: string | null = null;
  for (const raw of yaml.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && last) {
      const prev = out[last];
      const value = unquote(item[1]);
      out[last] = Array.isArray(prev) ? [...prev, value] : prev ? [prev, value] : [value];
      continue;
    }
    const kv = /^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    last = kv[1];
    const value = kv[2].trim();
    out[last] = /^\[.*\]$/.test(value)
      ? value.slice(1, -1).split(",").map(unquote).filter(Boolean)
      : unquote(value);
  }
  return out;
}

export function splitFrontMatter(src: string): { meta: FrontMatter | null; body: string } {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { meta: null, body: src };
  return { meta: parseFrontMatter(m[1]), body: src.slice(m[0].length) };
}

const pick = (meta: FrontMatter | null, keys: string[]): string | null => {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
};

export const STATUS_KEYS = ["status", "state"];
export const DATE_KEYS = ["updated", "last_updated", "lastUpdated", "modified", "date"];
export const metaStatus = (meta: FrontMatter | null) => pick(meta, STATUS_KEYS);
export const metaDate = (meta: FrontMatter | null) => pick(meta, DATE_KEYS);
