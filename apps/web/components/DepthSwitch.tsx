"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DeepPayload } from "@/lib/content-types";

/**
 * The interactive half of a lesson panel: the Short/Deep buttons, and the deep
 * content itself once someone asks for it.
 *
 * Deep prose is deliberately NOT passed in from the server. Anything rendered
 * inside a client component is serialized into the RSC payload whether or not
 * it ends up on screen — as a named prop, as `children`, hidden by CSS, it
 * makes no difference. The only way off the initial payload is to not send it,
 * so it's fetched from a prerendered static route on first use.
 */
export function DepthSwitch({
  id,
  hasDeep,
  children,
}: {
  id: string;
  hasDeep: boolean;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"short" | "deep">("short");
  const [deep, setDeep] = useState<DeepPayload | null>(null);
  const [failed, setFailed] = useState(false);

  // Fetch once, the first time deep mode is opened; afterwards the toggle is
  // just a class flip.
  useEffect(() => {
    if (mode !== "deep" || deep || failed) return;
    let live = true;
    fetch(`/api/deep/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: DeepPayload) => {
        if (live) setDeep(data);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [mode, deep, failed, id]);

  return (
    <section className="lesson-panel" data-lesson-id={id} data-mode={mode}>
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
      {children}
      {mode === "deep" && (
        <div className="lesson-body lesson-body-deep">
          {failed ? (
            <p className="lesson-deep-note">Deep dive unavailable.</p>
          ) : !deep ? (
            <p className="lesson-deep-note">Loading deep dive…</p>
          ) : (
            <>
              <Prose text={deep.deep_text ?? ""} />
              {deep.interview && deep.interview.length > 0 && (
                <div className="lesson-interview">
                  <h3>How this gets asked in interviews</h3>
                  {deep.interview.map((q, i) => (
                    <details key={i}>
                      <summary>{q.question}</summary>
                      <p>{q.answer}</p>
                    </details>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
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
