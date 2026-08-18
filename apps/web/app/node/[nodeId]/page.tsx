import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode, getBreadcrumbPath } from "@/lib/content";
import { NodeViewSwitcher } from "@/components/NodeViewSwitcher";
import { LessonPanel } from "@/components/LessonPanel";

export async function generateMetadata({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const node = getNode(nodeId);
  if (!node) return {};
  return {
    title: `${node.title} — learnforge.fyi`,
    description: node.text.slice(0, 160),
  };
}

export default async function NodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const node = getNode(nodeId);
  if (!node) notFound();

  const trail = getBreadcrumbPath(nodeId) ?? [node];
  const ancestors = trail.slice(0, -1);
  const lessons = [node, ...node.children];
  const topicRoot = trail[0];

  return (
    <div className="node-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/" className="breadcrumb-link">
          Home
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="breadcrumb-item">
            <span className="breadcrumb-sep" aria-hidden="true">
              /
            </span>
            <Link href={`/node/${a.id}`} className="breadcrumb-link">
              {a.title}
            </Link>
          </span>
        ))}
        <span className="breadcrumb-item">
          <span className="breadcrumb-sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumb-current">{node.title}</span>
        </span>
      </nav>

      <NodeViewSwitcher topicRoot={topicRoot} currentId={node.id}>
        <div className="lesson-track" aria-label={`${node.title} learning path`}>
          {lessons.map((lesson, i) => (
            <LessonPanel
              key={lesson.id}
              lesson={lesson}
              index={i}
              total={lessons.length}
              isRoot={i === 0}
            />
          ))}
        </div>
      </NodeViewSwitcher>
    </div>
  );
}
