import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Topic } from "@kbforge/content-types";
import type { ContentProvider } from "../generate/provider.ts";
import { NemotronProvider } from "../generate/provider.ts";
import { defineScope } from "./scope.ts";
import { buildOutline } from "./outline.ts";
import { structureTopic } from "./structure.ts";
import { fillContent } from "./content.ts";
import { slugify } from "./slugify.ts";

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content");

/**
 * Full authoring chain: scope agent -> outline agent -> structure (planning)
 * agent -> content-writing agent. Takes a bare pathway name (e.g. "Frontend
 * Development") and produces a complete Topic tree, writing it to
 * content/topics/<slug>.json.
 */
export async function authorPathway(
  pathway: string,
  provider: ContentProvider = new NemotronProvider(),
): Promise<Topic> {
  console.log(`[author] defining scope for "${pathway}"...`);
  const scope = await defineScope(pathway, provider);

  console.log(`[author] building outline for "${scope.title}"...`);
  const outline = await buildOutline(scope, provider);

  console.log(`[author] structuring topic tree...`);
  const structured = structureTopic(scope, outline);

  console.log(`[author] writing content for each node (this walks the whole tree)...`);
  const root = await fillContent(structured, provider);

  const topic: Topic = { root };

  const outPath = join(CONTENT_DIR, "topics", `${slugify(scope.title)}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(topic, null, 2) + "\n");
  console.log(`[author] wrote ${outPath}`);

  return topic;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pathway = process.argv[2];
  if (!pathway) {
    console.error('Usage: tsx author/index.ts "<pathway name>"');
    process.exit(1);
  }
  authorPathway(pathway).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
