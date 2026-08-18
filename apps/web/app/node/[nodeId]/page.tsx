import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode, getBreadcrumbPath } from "@/lib/content";
import type { Node } from "@kbforge/content-types";

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
  const lessons = [node, ...node.children];

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
    </div>
  );
}

function LessonPanel({
  lesson,
  index,
  total,
  isRoot,
}: {
  lesson: Node;
  index: number;
  total: number;
  isRoot: boolean;
}) {
  const hasChildren = lesson.children.length > 0;

  return (
    <section className="lesson-panel">
      <article className="lesson-copy">
        <div className="lesson-meta">
          <span className="level-pill">{LEVEL_LABEL[lesson.level]}</span>
          <span className="lesson-count">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        {isRoot ? <h1>{lesson.title}</h1> : <h2>{lesson.title}</h2>}
        <p>{lesson.text}</p>
        <div className="lesson-actions">
          {hasChildren && !isRoot ? (
            <Link className="child-link" href={`/node/${lesson.id}`}>
              Open path
              <span aria-hidden="true">→</span>
            </Link>
          ) : hasChildren ? (
            <span className="lesson-end">Scroll for {lesson.children.length} sections</span>
          ) : (
            <span className="lesson-end">Leaf concept</span>
          )}
          <VideoStatus status={lesson.status} />
        </div>
      </article>

      <div className="lesson-video-wrap">
        <VideoStage lesson={lesson} index={index} />
        <details className="mobile-copy-sheet">
          <summary>Read this section</summary>
          <div>
            <h2>{lesson.title}</h2>
            <p>{lesson.text}</p>
            {hasChildren && (
              <Link className="mobile-deeper-link" href={`/node/${lesson.id}`}>
                Go deeper
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

function VideoStage({ lesson, index }: { lesson: Node; index: number }) {
  if (lesson.youtube_video_id) {
    return (
      <div className="short-frame">
        <iframe
          title={`${lesson.title} short video`}
          src={`https://www.youtube.com/embed/${lesson.youtube_video_id}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="short-frame short-frame-pending" aria-label={`Video preview for ${lesson.title}`}>
      <div className="short-topbar">
        <span />
        <span />
        <span />
      </div>
      <div className="short-orbit" aria-hidden="true">
        <span className="short-node short-node-main">{String(index + 1).padStart(2, "0")}</span>
        <span className="short-node short-node-a" />
        <span className="short-node short-node-b" />
      </div>
      <div className="short-caption">
        <span>Short-form explainer</span>
        <strong>{lesson.title}</strong>
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
