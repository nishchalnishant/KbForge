/**
 * Top-level per-node pipeline runner: capture -> avatar -> upload -> backfill.
 * generate/ is intentionally excluded — it's invoked separately by whatever
 * authors new nodes, not on every publish run (PRD §4).
 *
 * Requires apps/web already running locally at baseUrl (default localhost:3000)
 * so capture/ can record the live page.
 */
import { getNode } from "./lib/content.ts";
import { captureNode } from "./capture/index.ts";
import { renderAvatarForNode } from "./avatar/index.ts";
import { uploadNode } from "./upload/index.ts";
import { backfillNode } from "./backfill/index.ts";

export async function runPipelineForNode(nodeId: string, baseUrl?: string): Promise<void> {
  const node = getNode(nodeId);
  if (!node) throw new Error(`node ${nodeId} not found in content/`);

  console.log(`[${nodeId}] capturing screen recording...`);
  const screenRecordingPath = await captureNode({ nodeId, baseUrl });

  console.log(`[${nodeId}] rendering avatar + compositing...`);
  const compositedPath = await renderAvatarForNode({
    nodeId,
    script: node.text,
    screenRecordingPath,
  });

  console.log(`[${nodeId}] uploading to YouTube...`);
  const { youtubeVideoId } = await uploadNode({
    filePath: compositedPath,
    title: node.title,
    description: node.text,
  });

  console.log(`[${nodeId}] backfilling youtube_video_id ${youtubeVideoId}...`);
  backfillNode(nodeId, youtubeVideoId);

  console.log(`[${nodeId}] done: https://www.youtube.com/watch?v=${youtubeVideoId}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const nodeId = process.argv[2];
  if (!nodeId) {
    console.error("usage: tsx run.ts <nodeId>");
    process.exit(1);
  }
  runPipelineForNode(nodeId).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
