/**
 * Writes youtube_video_id + status: "published" back onto a Node's JSON,
 * in place, inside content/topics/*.json — the final pipeline stage.
 * Content lives as git-tracked JSON (PRD §3), so this mutates the file
 * directly rather than a database row.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node, Topic } from "@kbforge/content-types";

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content");

function setPublished(node: Node, nodeId: string, youtubeVideoId: string): boolean {
  if (node.id === nodeId) {
    node.youtube_video_id = youtubeVideoId;
    node.status = "published";
    return true;
  }
  return node.children.some((child) => setPublished(child, nodeId, youtubeVideoId));
}

export function backfillNode(nodeId: string, youtubeVideoId: string): void {
  const topicsDir = join(CONTENT_DIR, "topics");
  const files = readdirSync(topicsDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = join(topicsDir, file);
    const topic = JSON.parse(readFileSync(filePath, "utf-8")) as Topic;

    if (setPublished(topic.root, nodeId, youtubeVideoId)) {
      writeFileSync(filePath, `${JSON.stringify(topic, null, 2)}\n`);
      return;
    }
  }

  throw new Error(`backfill failed — node ${nodeId} not found in any topic under ${topicsDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [nodeId, youtubeVideoId] = process.argv.slice(2);
  if (!nodeId || !youtubeVideoId) {
    console.error("usage: tsx backfill/index.ts <nodeId> <youtubeVideoId>");
    process.exit(1);
  }
  backfillNode(nodeId, youtubeVideoId);
  console.log(`backfilled ${nodeId} -> ${youtubeVideoId}`);
}
