import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode, getBreadcrumbPath, getSiblings } from "@/lib/content";
import { NodeViewSwitcher } from "@/components/NodeViewSwitcher";
import { LessonPanel } from "@/components/LessonPanel";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const node = getNode(nodeId);
  if (!node) return {};
  return {
    title: `${node.title} — learnforge.fyi`,
    description: node.text.slice(0, 160),
    alternates: {
      canonical: `/node/${nodeId}`,
    },
    openGraph: {
      title: node.title,
      description: node.text.slice(0, 160),
      url: `/node/${nodeId}`,
      type: "article",
    },
  };
}

export default async function NodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const node = getNode(nodeId);
  if (!node) notFound();

  const trail = getBreadcrumbPath(nodeId) ?? [node];
  const ancestors = trail.slice(0, -1);
  const lessons = [node, ...node.children];
  const topicRoot = trail[0];
  const lastLesson = lessons[lessons.length - 1];
  const sibling = getSiblings(lastLesson.id);
  const prevSibling = sibling && sibling.index > 0 ? sibling.siblings[sibling.index - 1] : undefined;
  const nextSibling =
    sibling && sibling.index < sibling.siblings.length - 1 ? sibling.siblings[sibling.index + 1] : undefined;
  const otherSiblings = sibling ? sibling.siblings.filter((_, i) => i !== sibling.index) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: node.title,
    description: node.text,
    url: `${SITE_URL}/node/${nodeId}`,
    isPartOf: {
      "@type": "Course",
      name: topicRoot.title,
      url: `${SITE_URL}/node/${topicRoot.id}`,
    },
    ...(node.children.length > 0 && {
      hasPart: node.children.map((c) => ({
        "@type": "LearningResource",
        name: c.title,
        url: `${SITE_URL}/node/${c.id}`,
      })),
    }),
  };

  return (
    <div className="node-page">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

      <NodeViewSwitcher topicRoot={topicRoot} currentId={node.id}>
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
      </NodeViewSwitcher>

      {sibling && (sibling.siblings.length > 1 || prevSibling || nextSibling) && (
        <nav className="sibling-nav" aria-label="Related concepts">
          <div className="sibling-nav-pair">
            {prevSibling ? (
              <Link href={`/node/${prevSibling.id}`} className="sibling-nav-link sibling-nav-prev">
                <span aria-hidden="true">←</span> {prevSibling.title}
              </Link>
            ) : (
              <span />
            )}
            {nextSibling && (
              <Link href={`/node/${nextSibling.id}`} className="sibling-nav-link sibling-nav-next">
                {nextSibling.title} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          {otherSiblings.length > 0 && (
            <div className="sibling-nav-list">
              <span className="sibling-nav-heading">Other concepts in this section</span>
              <div className="sibling-nav-chips">
                {otherSiblings.map((s) => (
                  <Link key={s.id} href={`/node/${s.id}`} className="sibling-nav-chip">
                    {s.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
