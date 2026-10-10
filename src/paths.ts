// Path helpers for Windows ("C:\docs", "\\server\share") and macOS ("/Users/me/docs") paths.
// A path keeps its platform's separator; which one is read from the path itself.

const isPosix = (p: string) => p.startsWith("/");
const sepOf = (p: string) => (isPosix(p) ? "/" : "\\");
const trimEnd = (p: string) => p.replace(isPosix(p) ? /\/+$/ : /\\+$/, "");

export const norm = (p: string): string => (isPosix(p) ? p : p.replace(/\//g, "\\"));

/**
 * Comparison and storage key for a path. Case is ignored on both platforms: Windows and the
 * default macOS volume format are case-insensitive.
 */
export const pathKey = (p: string): string => norm(p).toLowerCase();

export const samePath = (a: string, b: string): boolean => pathKey(a) === pathKey(b);

export const isMarkdown = (p: string): boolean => /\.(md|markdown)$/i.test(p);

/** `dir` and `name` joined with the separator of `dir`. */
export const joinPath = (dir: string, name: string): string => trimEnd(norm(dir)) + sepOf(dir) + name;

export function basename(p: string): string {
  const s = trimEnd(norm(p));
  return s.slice(s.lastIndexOf(sepOf(p)) + 1) || s || p;
}

export function dirname(p: string): string {
  const s = norm(p);
  const i = s.lastIndexOf(sepOf(p));
  if (i < 0) return s;
  if (isPosix(s)) return i === 0 ? "/" : s.slice(0, i);
  // Keep the separator after a drive letter: "C:\file.md" -> "C:\"
  return i === 2 && s[1] === ":" ? s.slice(0, 3) : s.slice(0, i);
}

/** Root folder of an opened path: trailing separators go, except where they are the root. */
export function rootOf(p: string): string {
  const s = trimEnd(norm(p));
  if (isPosix(p)) return s || "/";
  // "D:" alone would mean the current folder on D.
  return /^[a-zA-Z]:$/.test(s) ? `${s}\\` : s || norm(p);
}

function collapse(p: string): string {
  const posix = isPosix(p);
  const sep = posix ? "/" : "\\";
  const unc = !posix && p.startsWith("\\\\");
  const segs = (unc ? p.slice(2) : p).split(sep);
  // ".." never climbs above "/", the drive, or the server and share of a UNC path.
  const floor = posix ? 0 : unc ? 2 : 1;
  const out: string[] = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (out.length > floor) out.pop();
      continue;
    }
    out.push(s);
  }
  const joined = out.join(sep);
  if (posix) return "/" + joined;
  if (unc) return "\\\\" + joined;
  return out.length === 1 && /^[a-zA-Z]:$/.test(out[0]) ? joined + "\\" : joined;
}

/** Percent-decodes a link part; text that is not valid escaping (e.g. "100%.md") stays as it is. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Splits a link into its path and decoded fragment; the query is dropped. */
export function splitLink(href: string): { path: string; hash: string | null } {
  const m = /^([^?#]*)(?:\?[^#]*)?(?:#([\s\S]*))?$/.exec(href)!;
  return { path: m[1], hash: m[2] === undefined ? null : safeDecode(m[2]) };
}

/**
 * Resolves the path part of a link found in a document.
 * Relative paths resolve against the document's folder; a leading slash means the opened root.
 */
export function resolvePath(baseDir: string, target: string, root?: string | null): string {
  const t = safeDecode(target);
  if (isPosix(baseDir)) {
    const rel = t.replace(/\\/g, "/");
    return collapse((rel.startsWith("/") ? root ?? baseDir : baseDir + "/") + rel);
  }
  const w = t.replace(/\//g, "\\");
  if (/^[a-zA-Z]:\\/.test(w) || w.startsWith("\\\\")) return collapse(w);
  if (w.startsWith("\\")) return collapse((root ?? baseDir) + w);
  return collapse(baseDir + "\\" + w);
}

/** Path segments of `p` below `root`, or null when `p` is outside it. */
export function relativeParts(root: string, p: string): string[] | null {
  const sep = sepOf(root);
  const r = trimEnd(norm(root));
  const s = norm(p);
  if (!pathKey(s).startsWith(pathKey(r) + sep)) return null;
  return s.slice(r.length + 1).split(sep).filter(Boolean);
}
