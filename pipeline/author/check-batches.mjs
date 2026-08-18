/**
 * Validates authored batch files against the AUTHORING.md spec before merge.
 *
 * Checks each node for: word counts within tolerance, no markdown leaking into
 * strings, exactly 3 interview questions where present, and — by cross-checking
 * the job input — that interview questions appear on leaves and only leaves.
 *
 *   node pipeline/author/check-batches.mjs machine-learning
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
if (!slug) {
  console.error("usage: node check-batches.mjs <topic-slug>");
  process.exit(1);
}

const dir = join(here, "batches", slug);
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".json") && !f.startsWith("_") && !f.includes(".input."),
);

/** Leaf-ness comes from the job inputs, which are the source of truth. */
const isLeaf = new Map();
for (const f of readdirSync(dir).filter((f) => f.includes(".input."))) {
  for (const n of JSON.parse(readFileSync(join(dir, f), "utf8")).nodes) {
    isLeaf.set(n.id, (n.children ?? []).length === 0);
  }
}

const words = (s) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;
let total = 0;
let problems = 0;

for (const f of files.sort()) {
  const content = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const issues = [];

  for (const [id, v] of Object.entries(content)) {
    const tw = words(v.text);
    const dw = words(v.deep_text);
    const leaf = isLeaf.get(id);

    if (tw < 75 || tw > 130) issues.push(`${id}: text=${tw}w`);
    if (dw < 240) issues.push(`${id}: deep=${dw}w`);
    if (leaf && dw < 330) issues.push(`${id}: leaf deep=${dw}w`);
    // Only real markdown syntax. A bare `*` is usually multiplication in a
    // maths expression (w1*x1), which is fine in prose; paired emphasis,
    // headings, backticks and list bullets are not.
    // Multiplication between operands (w1*x1, 2*(y - t)) is ordinary prose;
    // drop those before looking for genuine markdown syntax.
    const prose = `${v.text}\n${v.deep_text}`.replace(
      /(?<=[\w)])\s*\*\s*(?=[\w(])/g,
      " times ",
    );
    if (/\*|`|^\s*#{1,6}\s|^\s*[-•]\s/m.test(prose))
      issues.push(`${id}: markdown`);

    const iv = v.interview;
    if (leaf && (!Array.isArray(iv) || iv.length !== 3))
      issues.push(`${id}: leaf interview=${iv ? iv.length : "none"}`);
    if (leaf === false && iv) issues.push(`${id}: parent has interview`);
    if (Array.isArray(iv))
      for (const q of iv)
        if (!q?.question?.trim() || !q?.answer?.trim())
          issues.push(`${id}: empty Q/A`);
    if (leaf === undefined) issues.push(`${id}: not in any job input`);
  }

  total += Object.keys(content).length;
  problems += issues.length;
  console.log(
    `${f.padEnd(48)} ${String(Object.keys(content).length).padStart(3)} nodes  ${
      issues.length ? "ISSUES\n    " + issues.join("\n    ") : "ok"
    }`,
  );
}

console.log(`\n${files.length} batches, ${total} nodes, ${problems} issues`);
