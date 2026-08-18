import { NextResponse } from "next/server";
import { getTopic, getTopicSummaries, getTreeSkeleton } from "@/lib/content";

export const dynamic = "force-static";

/** Prerender one skeleton file per topic so the fetch is a static asset. */
export function generateStaticParams() {
  return getTopicSummaries().map((t) => ({ topicId: t.id }));
}

/**
 * The tree map's structure, served separately from the page. Inlining it as
 * client props cost every reader the whole topic skeleton whether or not they
 * ever opened the map.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const topic = getTopic(topicId);
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(getTreeSkeleton(topic.root));
}
