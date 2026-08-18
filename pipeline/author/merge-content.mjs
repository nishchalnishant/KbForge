/**
 * Merges per-batch content files into the topic skeleton.
 *
 * Each batch file is { "<node-id>": { text, deep_text, interview? }, ... }.
 * Keeping batches as separate files is what makes the fill resumable and
 * parallel-safe: two writers never touch the same file, and a failed batch
 * costs one batch rather than the whole topic.
 *
 *   node pipeline/author/merge-content.mjs machine-learning
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const slug = process.argv[2];
if (!slug) {
  console.error("usage: node merge-content.mjs <topic-slug>");
  process.exit(1);
}

const topic = JSON.parse(readFileSync(join(here, "outlines", `${slug}.skeleton.json`), "utf8"));
const batchDir = join(here, "batches", slug);

const content = {};
if (existsSync(batchDir)) {
  for (const f of readdirSync(batchDir).filter((f) => f.endsWith(".json")).sort()) {
    Object.assign(content, JSON.parse(readFileSync(join(batchDir, f), "utf8")));
  }
}

const missing = [];
let filled = 0;

(function apply(n) {
  const c = content[n.id];
  if (c && typeof c.text === "string" && c.text.trim()) {
    n.text = c.text.trim();
    if (c.deep_text && c.deep_text.trim()) n.deep_text = c.deep_text.trim();
    if (Array.isArray(c.interview) && c.interview.length) {
      n.interview = c.interview
        .filter((q) => q && q.question && q.answer)
        .slice(0, 3);
    }
    filled++;
  } else {
    missing.push(`${n.level}\t${n.id}\t${n.title}`);
  }
  n.children.forEach(apply);
})(topic.root);

topic.meta.authored_at = new Date().toISOString();

writeFileSync(
  join(repo, "content", "topics", `${slug}.json`),
  JSON.stringify(topic, null, 2) + "\n",
);

console.log(`filled ${filled}, missing ${missing.length}`);
if (missing.length) {
  writeFileSync(join(batchDir, "_missing.tsv"), missing.join("\n") + "\n");
  console.log(missing.slice(0, 15).join("\n"));
  if (missing.length > 15) console.log(`... +${missing.length - 15} more`);
}
