"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node as FlowNode,
  type Edge as FlowEdge,
  type EdgeProps,
  type NodeProps,
  useInternalNode,
  BaseEdge,
  getStraightPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Node } from "@kbforge/content-types";

const RADIUS_STEP = 240;
const CARD_WIDTH = 190;
const CARD_HEIGHT = 74;

const LEVEL_LABEL: Record<string, string> = {
  topic: "Topic",
  section: "Section",
  subsection: "Subsection",
  unit: "Unit",
};

interface LayoutNode {
  id: string;
  title: string;
  level: string;
  status: string;
  x: number;
  y: number;
  parentId?: string;
  hasChildren: boolean;
}

function layoutRadial(root: Node): { nodes: LayoutNode[]; edges: { from: string; to: string }[] } {
  const nodes: LayoutNode[] = [];
  const edges: { from: string; to: string }[] = [];

  function place(node: Node, depth: number, angleStart: number, angleEnd: number, parentId?: string) {
    const angle = (angleStart + angleEnd) / 2;
    const radius = depth * RADIUS_STEP;
    const x = depth === 0 ? 0 : radius * Math.cos(angle);
    const y = depth === 0 ? 0 : radius * Math.sin(angle);

    nodes.push({
      id: node.id,
      title: node.title,
      level: node.level,
      status: node.status,
      x,
      y,
      parentId,
      hasChildren: node.children.length > 0,
    });

    if (parentId) edges.push({ from: parentId, to: node.id });

    const span = angleEnd - angleStart;
    const step = node.children.length > 0 ? span / node.children.length : 0;
    node.children.forEach((child, i) => {
      place(child, depth + 1, angleStart + i * step, angleStart + (i + 1) * step, node.id);
    });
  }

  place(root, 0, 0, Math.PI * 2);
  return { nodes, edges };
}

function TreeNodeCard({ data }: NodeProps) {
  const d = data as unknown as LayoutNode & { isRoot: boolean };
  return (
    <div className={`tree-node-card tree-node-${d.level}${d.isRoot ? " tree-node-root" : ""}`}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="tree-node-level">{LEVEL_LABEL[d.level]}</span>
      <span className="tree-node-title">{d.title}</span>
      {d.status === "published" && <span className="tree-node-dot" aria-hidden="true" />}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { treeNode: TreeNodeCard };

function rectIntersection(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  tx: number,
  ty: number
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return { x: cx + dx * scale, y: cy + dy * scale };
}

function FloatingEdge({ id, source, target, style, markerEnd }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sx = sourceNode.internals.positionAbsolute.x + (sourceNode.measured.width ?? CARD_WIDTH) / 2;
  const sy = sourceNode.internals.positionAbsolute.y + (sourceNode.measured.height ?? CARD_HEIGHT) / 2;
  const tx = targetNode.internals.positionAbsolute.x + (targetNode.measured.width ?? CARD_WIDTH) / 2;
  const ty = targetNode.internals.positionAbsolute.y + (targetNode.measured.height ?? CARD_HEIGHT) / 2;

  const start = rectIntersection(
    sx,
    sy,
    (sourceNode.measured.width ?? CARD_WIDTH) / 2,
    (sourceNode.measured.height ?? CARD_HEIGHT) / 2,
    tx,
    ty
  );
  const end = rectIntersection(
    tx,
    ty,
    (targetNode.measured.width ?? CARD_WIDTH) / 2,
    (targetNode.measured.height ?? CARD_HEIGHT) / 2,
    sx,
    sy
  );

  const [path] = getStraightPath({
    sourceX: start.x,
    sourceY: start.y,
    targetX: end.x,
    targetY: end.y,
  });

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}

const edgeTypes = { floating: FloatingEdge };

export function TreeView({ root, currentId }: { root: Node; currentId: string }) {
  const router = useRouter();
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => layoutRadial(root), [root]);

  const flowNodes: FlowNode[] = useMemo(
    () =>
      layoutNodes.map((n) => ({
        id: n.id,
        type: "treeNode",
        position: { x: n.x, y: n.y },
        data: { ...n, isRoot: n.id === root.id },
        draggable: false,
        selectable: true,
      })),
    [layoutNodes, root.id]
  );

  const flowEdges: FlowEdge[] = useMemo(
    () =>
      layoutEdges.map((e) => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        type: "floating",
        style: { stroke: "rgba(255,176,0,0.3)", strokeWidth: 1.5 },
      })),
    [layoutEdges]
  );

  const onNodeClick = useCallback(
    (_: unknown, node: FlowNode) => {
      if (node.id === currentId) return;
      router.push(`/node/${node.id}`);
    },
    [router, currentId]
  );

  return (
    <div className="tree-view-wrap">
      <div className="tree-view-canvas">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.15}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.06)" gap={28} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
