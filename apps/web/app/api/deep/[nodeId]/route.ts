import { NextResponse } from "next/server";
import { getDeepNodeIds, getDeepPayload } from "@/lib/content";

export const dynamic = "force-static";

/** Prerender one file per node that has deep content, so the fetch is a static asset. */
export function generateStaticParams() {
  return getDeepNodeIds().map((nodeId) => ({ nodeId }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const payload = getDeepPayload(nodeId);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payload);
}
