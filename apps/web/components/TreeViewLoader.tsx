"use client";

import { useEffect, useState } from "react";
import type { TreeNode } from "@/lib/tree";
import { TreeView } from "@/components/TreeView";

/**
 * Fetches the topic skeleton on demand. Together with the dynamic import in
 * NodeViewSwitcher this keeps both React Flow and the tree data off the page
 * for readers who never open the map.
 */
export function TreeViewLoader({ topicId, currentId }: { topicId: string; currentId: string }) {
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/tree/${topicId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: TreeNode) => {
        if (live) setRoot(data);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [topicId]);

  if (failed) return <div className="tree-loading">Map unavailable.</div>;
  if (!root) return <div className="tree-loading">Loading map…</div>;
  return <TreeView root={root} currentId={currentId} />;
}
