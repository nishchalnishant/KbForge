import Link from "next/link";
import { getTopicSummaries } from "@/lib/content";

export default function NotFound() {
  const topics = getTopicSummaries();

  return (
    <main className="not-found">
      <span className="not-found-code">404</span>
      <h1>That node doesn&apos;t exist.</h1>
      <p>The concept you&apos;re looking for may have moved or been renamed. Try one of the topics below.</p>
      <Link href="/" className="not-found-home">
        Back to home <span aria-hidden="true">→</span>
      </Link>
      <div className="not-found-topics">
        {topics.map((t) => (
          <Link key={t.id} href={`/node/${t.id}`} className="not-found-topic-link">
            {t.title}
          </Link>
        ))}
      </div>
    </main>
  );
}
