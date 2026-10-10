export type TreeNode = { name: string; path: string; children?: TreeNode[] };
export type FileData = { text: string; modifiedMs: number };

/** What is open. Each module keeps its own view state; only these are shared. */
export const state = {
  root: null as string | null,
  tree: [] as TreeNode[],
  /** The document on screen; null while a message page is shown. Always inside `root`. */
  current: null as string | null,
};
