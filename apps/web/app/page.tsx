import type { CSSProperties } from "react";
import Link from "next/link";
import { getAllTopics, countAll, countPublished } from "@/lib/content";

const LEVEL_LABEL: Record<string, string> = {
  topic: "Topic",
  section: "Section",
  subsection: "Subsection",
  unit: "Unit",
};

export default function HomePage() {
  const topics = getAllTopics();
  const totalNodes = topics.reduce((sum, t) => sum + countAll(t.root), 0);

  return (
    <main className="home">
      <section className="hero">
        <span className="hero-badge">
          <span className="hero-badge-dot" aria-hidden="true" />
          Built as a living, git-versioned skill tree
        </span>
        <h1 className="hero-title">
          Learn things properly,
          <br />
          <span className="hero-title-accent">one node at a time.</span>
        </h1>
        <p className="hero-sub">
          Every concept is a card: a short, precise explanation you can read in
          under a minute. Go deeper when you want to, stop when you don&apos;t.
          Text is here now — narrated video is landing on the same pages soon.
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <strong>{topics.length}</strong>
            <span>topics</span>
          </div>
          <div className="hero-stat">
            <strong>{totalNodes}</strong>
            <span>concepts</span>
          </div>
          <div className="hero-stat">
            <strong>0</strong>
            <span>accounts needed</span>
          </div>
        </div>
      </section>

      <section className="topic-grid" aria-label="Topics">
        {topics.map((t, idx) => {
          const total = countAll(t.root);
          const published = countPublished(t.root);
          const pct = total ? Math.round((published / total) * 100) : 0;
          return (
            <Link
              key={t.root.id}
              className="topic-card"
              href={`/node/${t.root.id}`}
              style={{ "--i": idx } as CSSProperties}
            >
              <span className="topic-card-glow" aria-hidden="true" />
              <div className="topic-card-top">
                <span className="level-pill">{LEVEL_LABEL[t.root.level]}</span>
                <span className="topic-card-count">{total} concepts</span>
              </div>
              <h2 className="topic-card-title">{t.root.title}</h2>
              <p className="topic-card-text">{t.root.text}</p>
              <div className="topic-card-footer">
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="topic-card-pct">{pct}%</span>
                <span className="topic-card-cta">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
