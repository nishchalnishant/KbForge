"use client";

import { useState, type ReactNode } from "react";
import type { Node } from "@kbforge/content-types";
import { TreeView } from "@/components/TreeView";

export function NodeViewSwitcher({
  topicRoot,
  currentId,
  children,
}: {
  topicRoot: Node;
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

      {view === "list" ? children : <TreeView root={topicRoot} currentId={currentId} />}
    </div>
  );
}
