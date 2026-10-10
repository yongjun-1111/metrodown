// Windows path helpers. All paths use backslashes internally.

export const norm = (p: string): string => p.replace(/\//g, "\\");

export const samePath = (a: string, b: string): boolean => norm(a).toLowerCase() === norm(b).toLowerCase();

export const isMarkdown = (p: string): boolean => /\.(md|markdown)$/i.test(p);

export function basename(p: string): string {
  const s = norm(p).replace(/\\+$/, "");
  return s.slice(s.lastIndexOf("\\") + 1) || s;
}

export function dirname(p: string): string {
  const s = norm(p);
  const i = s.lastIndexOf("\\");
  if (i < 0) return s;
  // Keep the separator after a drive letter: "C:\file.md" -> "C:\"
  return i === 2 && s[1] === ":" ? s.slice(0, 3) : s.slice(0, i);
}

function collapse(p: string): string {
  const unc = p.startsWith("\\\\");
  const segs = (unc ? p.slice(2) : p).split("\\");
  const out: string[] = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (out.length > 1) out.pop();
      continue;
    }
    out.push(s);
  }
  const joined = out.join("\\");
  if (unc) return "\\\\" + joined;
  return out.length === 1 && /^[a-zA-Z]:$/.test(out[0]) ? joined + "\\" : joined;
}

function safeDecode(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

/**
 * Resolves a link target found in a document.
 * Relative paths resolve against the document's folder; a leading slash means the opened root.
 */
export function resolvePath(baseDir: string, target: string, root?: string | null): string {
  const t = norm(safeDecode(target));
  if (/^[a-zA-Z]:\\/.test(t) || t.startsWith("\\\\")) return collapse(t);
  if (t.startsWith("\\")) return collapse((root ?? baseDir) + t);
  return collapse(baseDir + "\\" + t);
}

/** Path segments of `p` below `root`, or null when `p` is outside it. */
export function relativeParts(root: string, p: string): string[] | null {
  const r = norm(root).replace(/\\+$/, "");
  const s = norm(p);
  if (!s.toLowerCase().startsWith(r.toLowerCase() + "\\")) return null;
  return s.slice(r.length + 1).split("\\").filter(Boolean);
}
