import Link from "next/link";
import type { Node } from "@kbforge/content-types";
import { DepthSwitch } from "@/components/DepthSwitch";

const LEVEL_LABEL: Record<string, string> = {
  topic: "Topic",
  section: "Section",
  subsection: "Subsection",
  unit: "Unit",
};

/**
 * Server component: all prose is rendered here and handed to DepthSwitch as
 * pre-rendered markup, so the lesson body never crosses the client boundary
 * as raw data.
 */
export function LessonPanel({
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
  const hasDeep = Boolean(lesson.deep_text);

  return (
    <DepthSwitch id={lesson.id} hasDeep={hasDeep}>
      <article className="lesson-copy">
        <div className="lesson-meta">
          <span className="level-pill">{LEVEL_LABEL[lesson.level]}</span>
          <span className="lesson-count">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        {isRoot ? <h1>{lesson.title}</h1> : <h2>{lesson.title}</h2>}

        {/* Short copy only; the deep half is fetched by DepthSwitch on demand. */}
        <div className="lesson-body lesson-body-short">
          <Prose text={lesson.text} />
        </div>

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
          <span className="lesson-short-only">
            <VideoStatus status={lesson.status} />
          </span>
        </div>
      </article>

      <div className="lesson-video-wrap lesson-short-only">
        <VideoStage lesson={lesson} index={index} />
        <details className="mobile-copy-sheet">
          <summary>Read this section</summary>
          <div>
            <p>{lesson.text}</p>
            {hasChildren && !isRoot && (
              <Link className="mobile-deeper-link" href={`/node/${lesson.id}`}>
                Go deeper
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </details>
      </div>
    </DepthSwitch>
  );
}

/** Authored copy carries blank-line paragraph breaks; render them as paragraphs. */
function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i}>{p.trim()}</p>
      ))}
    </>
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
