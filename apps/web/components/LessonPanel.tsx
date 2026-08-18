"use client";

import { useState } from "react";
import Link from "next/link";
import type { Node } from "@kbforge/content-types";

const LEVEL_LABEL: Record<string, string> = {
  topic: "Topic",
  section: "Section",
  subsection: "Subsection",
  unit: "Unit",
};

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
  const [mode, setMode] = useState<"short" | "deep">("short");
  const showDeep = mode === "deep" && hasDeep;

  return (
    <section className={`lesson-panel${showDeep ? " lesson-panel-deep" : ""}`}>
      <article className="lesson-copy">
        <div className="lesson-meta">
          <span className="level-pill">{LEVEL_LABEL[lesson.level]}</span>
          <span className="lesson-count">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          {hasDeep && (
            <div className="depth-toggle" role="tablist" aria-label="Content depth">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "short"}
                className={`depth-toggle-btn${mode === "short" ? " depth-toggle-btn-active" : ""}`}
                onClick={() => setMode("short")}
              >
                Short
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "deep"}
                className={`depth-toggle-btn${mode === "deep" ? " depth-toggle-btn-active" : ""}`}
                onClick={() => setMode("deep")}
              >
                Deep dive
              </button>
            </div>
          )}
        </div>
        {isRoot ? <h1>{lesson.title}</h1> : <h2>{lesson.title}</h2>}
        <p>{showDeep ? lesson.deep_text : lesson.text}</p>
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
          {!showDeep && <VideoStatus status={lesson.status} />}
        </div>
      </article>

      {!showDeep && (
        <div className="lesson-video-wrap">
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
      )}
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
