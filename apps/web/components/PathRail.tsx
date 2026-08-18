"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SpineEntry } from "@/lib/content";

/**
 * Persistent orientation rail: the topic's spine with the reader's position
 * marked. The Tree map view answers "show me everything"; this answers
 * "where am I right now" without leaving the page.
 */
export function PathRail({
  spine,
  topicTitle,
  panelIds,
}: {
  spine: SpineEntry[];
  topicTitle: string;
  /** Lesson panels rendered on this page, in order, for scroll-sync. */
  panelIds: string[];
}) {
  const [activeId, setActiveId] = useState<string | null>(panelIds[0] ?? null);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  // Track which lesson panel is centred in the viewport so the rail marker
  // follows the reader as they scroll, rather than only on navigation.
  useEffect(() => {
    if (panelIds.length === 0) return;
    const seen = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.getAttribute("data-lesson-id");
          if (id) seen.set(id, e.intersectionRatio);
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        if (best) setActiveId(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-20% 0px -20% 0px" },
    );

    for (const id of panelIds) {
      const el = document.querySelector(`[data-lesson-id="${id}"]`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [panelIds]);

  // On a long spine the marker can sit outside the rail's own scroll window;
  // nudge it back into view without moving the page itself.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;
    const item = list.querySelector(`[data-spine-id="${activeId}"]`);
    if (!item) return;
    const itemBox = item.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    if (itemBox.top < listBox.top || itemBox.bottom > listBox.bottom) {
      // Set scrollTop directly: scrollIntoView would also scroll the page.
      const delta = itemBox.top - listBox.top - (listBox.height - itemBox.height) / 2;
      list.scrollTo({ top: list.scrollTop + delta, behavior: "smooth" });
    }
  }, [activeId]);

  return (
    <>
      <button
        type="button"
        className="path-rail-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide path" : "Show path"}
      </button>

      <nav
        className={`path-rail${open ? " path-rail-open" : ""}`}
        aria-label={`Your position in ${topicTitle}`}
      >
        <div className="path-rail-inner">
          <span className="path-rail-heading">{topicTitle}</span>
          <ol className="path-rail-list" ref={listRef}>
            {spine.map((n) => {
              // The scrolled-to panel wins; otherwise fall back to the routed node.
              const active = activeId ? n.id === activeId : n.isCurrent;
              const cls = [
                "path-rail-item",
                `path-rail-d${Math.min(n.depth, 4)}`,
                n.onPath ? "path-rail-on" : "",
                active ? "path-rail-active" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li key={n.id} className={cls} data-spine-id={n.id}>
                  <Link
                    href={`/node/${n.id}`}
                    className="path-rail-link"
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="path-rail-tick" aria-hidden="true" />
                    <span className="path-rail-title">{n.title}</span>
                    {n.of > 1 && (
                      <span className="path-rail-pos">
                        {n.position}/{n.of}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}
