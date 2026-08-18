import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode } from "@/lib/content";

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

  return (
    <div className="scroll-track">
      <section className="node-card">
        <div className="level-tag">{node.level}</div>
        <h1>{node.title}</h1>
        <p>{node.text}</p>
        {/* video toggle intentionally absent per PRD §1.4 — no video exists yet in M0 */}
      </section>

      {node.children.map((child) => (
        <section key={child.id} className="node-card">
          <div className="level-tag">{child.level}</div>
          <h2>{child.title}</h2>
          <p>{child.text}</p>
          <Link className="child-link" href={`/node/${child.id}`}>
            Go deeper: {child.title} →
          </Link>
        </section>
      ))}
    </div>
  );
}
