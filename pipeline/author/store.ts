import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node, Topic } from "@kbforge/content-types";
import { levels } from "./structure.ts";

/** Overridable so a dry run or a test can write somewhere disposable. */
export const CONTENT_DIR =
  process.env.KBFORGE_CONTENT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content");
export const TOPICS_DIR = join(CONTENT_DIR, "topics");

/**
 * Incremental, resumable topic storage.
 *
 * The original chain built the whole tree in memory and wrote once at the end,
 * so a rate-limit on node 64 of 65 threw away the other 64. Every stage here
 * checkpoints as it goes, and a re-run picks up whatever is already on disk.
 *
 * Writes go via a temp file + rename so an interrupted run can never leave a
 * half-written JSON file behind — which would otherwise break `apps/web`'s
 * build on the next deploy.
 */
export function topicPath(slug: string): string {
  return join(TOPICS_DIR, `${slug}.json`);
}

export function loadTopic(slug: string): Topic | null {
  const path = topicPath(slug);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Topic;
  } catch {
    return null;
  }
}

export function loadAllTopics(): Topic[] {
  if (!existsSync(TOPICS_DIR)) return [];
  return readdirSync(TOPICS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(TOPICS_DIR, f), "utf-8")) as Topic;
      } catch {
        return null;
      }
    })
    .filter((t): t is Topic => t !== null);
}

export function saveTopic(slug: string, topic: Topic): void {
  mkdirSync(TOPICS_DIR, { recursive: true });
  const target = topicPath(slug);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(topic, null, 2) + "\n");
  renameSync(tmp, target);
}

/**
 * Debounced checkpointer. Content fill can complete several nodes a second;
 * serialising the whole tree on every one is wasteful, and never serialising
 * loses work. This coalesces writes and guarantees a final flush.
 */
export function createCheckpointer(slug: string, topic: Topic, intervalMs = 2000) {
  let dirty = false;
  let timer: NodeJS.Timeout | null = null;

  const flush = () => {
    if (!dirty) return;
    saveTopic(slug, topic);
    dirty = false;
  };

  return {
    touch(): void {
      dirty = true;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, intervalMs);
    },
    flush(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
  };
}

/**
 * Copies text already on disk onto a freshly structured tree, matched by id.
 * Lets a re-run reuse prior work even when the outline changed — nodes that
 * survived keep their content, new nodes get written, removed nodes drop out.
 */
export function graftExisting(fresh: Node, existing: Node | undefined): number {
  if (!existing) return 0;

  const priorById = new Map<string, Node>();
  for (const node of levels(existing).flat()) priorById.set(node.id, node);

  let grafted = 0;
  for (const node of levels(fresh).flat()) {
    const prior = priorById.get(node.id);
    if (!prior || !prior.text.trim()) continue;
    node.text = prior.text;
    node.deep_text = prior.deep_text;
    node.interview = prior.interview;
    node.prerequisites = prior.prerequisites;
    node.same_as = prior.same_as;
    node.verification = prior.verification;
    node.needs_review = prior.needs_review;
    node.youtube_video_id = prior.youtube_video_id;
    node.status = prior.status;
    grafted++;
  }
  return grafted;
}
