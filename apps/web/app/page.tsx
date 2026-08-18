import Link from "next/link";
import { getAllTopics } from "@/lib/content";

export default function HomePage() {
  const topics = getAllTopics();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 2rem" }}>
      <h1>learnforge.fyi</h1>
      <p style={{ color: "var(--muted)" }}>
        AI-narrated technical explainers, organized as skill trees.
      </p>
      <div className="children-list">
        {topics.map((t) => (
          <Link key={t.root.id} className="child-link" href={`/node/${t.root.id}`}>
            <div className="level-tag">{t.root.level}</div>
            <strong>{t.root.title}</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}
