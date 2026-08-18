"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

// React Flow is a heavy dependency and most readers never leave the list view,
// so the tree map is fetched only once someone actually asks for it.
const TreeViewLoader = dynamic(
  () => import("@/components/TreeViewLoader").then((m) => m.TreeViewLoader),
  {
    ssr: false,
    loading: () => <div className="tree-loading">Loading map…</div>,
  },
);

export function NodeViewSwitcher({
  topicId,
  currentId,
  children,
}: {
  /** Only the id crosses the boundary; the tree itself is fetched on demand. */
  topicId: string;
  currentId: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<"list" | "tree">("list");

  return (
    <div className="view-switcher-wrap">
      <div className="view-switcher" role="tablist" aria-label="Content view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "list"}
          className={`view-switch-btn${view === "list" ? " view-switch-btn-active" : ""}`}
          onClick={() => setView("list")}
        >
          List
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "tree"}
          className={`view-switch-btn${view === "tree" ? " view-switch-btn-active" : ""}`}
          onClick={() => setView("tree")}
        >
          Tree map
        </button>
      </div>

      {view === "list" ? children : <TreeViewLoader topicId={topicId} currentId={currentId} />}
    </div>
  );
}
