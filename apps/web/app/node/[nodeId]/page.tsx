import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode, getBreadcrumbPath } from "@/lib/content";

const LEVEL_LABEL: Record<string, string> = {
  topic: "Topic",
  section: "Section",
  subsection: "Subsection",
  unit: "Unit",
};

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

      <div className="scroll-track">
        <section className="node-card node-card-hero">
          <div className="node-card-top">
            <span className="level-pill">{LEVEL_LABEL[node.level]}</span>
            <VideoStatus status={node.status} />
          </div>
          <h1>{node.title}</h1>
          <p>{node.text}</p>
          {node.children.length > 0 && (
            <p className="scroll-hint">
              Scroll down for {node.children.length}{" "}
              {node.children.length === 1 ? "subtopic" : "subtopics"} ↓
            </p>
          )}
        </section>

        {node.children.map((child, i) => (
          <section key={child.id} className="node-card">
            <div className="node-card-top">
              <span className="level-pill">{LEVEL_LABEL[child.level]}</span>
              <VideoStatus status={child.status} />
            </div>
            <span className="node-card-index">
              {i + 1} / {node.children.length}
            </span>
            <h2>{child.title}</h2>
            <p>{child.text}</p>
            <Link className="child-link" href={`/node/${child.id}`}>
              Go deeper: {child.title}
              <span aria-hidden="true"> →</span>
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}

function VideoStatus({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="video-badge video-badge-live">
        <span className="video-dot" aria-hidden="true" />
        Video available
      </span>
    );
  }
  return <span className="video-badge video-badge-pending">Video coming soon</span>;
}
