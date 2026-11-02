/** Folder paths are slash-separated labels, e.g. "JAPAN/JSON/Tobira I". "" is the root. */

/** Collapse whitespace, drop empty segments, and strip edge slashes: " a//b " → "a/b". */
export function normalizePath(path: string): string {
  return path.split("/").map((s) => s.trim()).filter(Boolean).join("/");
}

/** "JAPAN" + "JSON/Tobira I" → "JAPAN/JSON/Tobira I"; "" + name → name. */
export function joinPath(parent: string, name: string): string {
  return normalizePath(`${parent}/${name}`);
}

/** "JAPAN/JSON/Tobira I" → "JAPAN/JSON"; "JAPAN" → "". */
export function parentPath(path: string): string {
  const p = normalizePath(path);
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** "JAPAN/JSON/Tobira I" → "Tobira I". */
export function pathName(path: string): string {
  const p = normalizePath(path);
  return p.slice(p.lastIndexOf("/") + 1);
}

/**
 * Direct subfolders of `at` among all known folder paths (ancestors of deep paths count),
 * matched case-insensitively, deduped (first-seen casing wins), name-sorted A → Z.
 */
export function childFolders(paths: string[], at: string): string[] {
  const parent = normalizePath(at);
  const depth = parent ? parent.split("/").length : 0;
  const pkey = parent.toLowerCase();
  const kids = new Map<string, string>();
  for (const raw of paths) {
    const segs = normalizePath(raw).split("/").filter(Boolean);
    if (segs.length <= depth) continue;
    const prefix = segs.slice(0, depth).join("/");
    if (prefix.toLowerCase() !== pkey) continue;
    const child = joinPath(parent, segs[depth]);
    const key = child.toLowerCase();
    if (!kids.has(key)) kids.set(key, child);
  }
  return [...kids.values()].sort((a, b) =>
    pathName(a).localeCompare(pathName(b), undefined, { sensitivity: "base" }),
  );
}
