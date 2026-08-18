/**
 * Structure-only mirror of a node: no prose, for the Tree map view.
 * Kept out of lib/content.ts so client components can import the type without
 * dragging the fs-based loader into the browser bundle.
 */
export type TreeNode = {
  id: string;
  title: string;
  level: string;
  status: string;
  children: TreeNode[];
};
