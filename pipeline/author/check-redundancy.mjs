/**
 * Cross-batch redundancy check.
 *
 * Contracts stop a node explaining its *siblings'* material, and each writer
 * could enforce that locally. Nothing stops two nodes in different batches
 * independently re-deriving the same idea — that is invisible to every
 * individual writer and is exactly the duplication readers notice.
 *
 * Compares every pair of nodes by rare-term overlap: common ML vocabulary is
 * ignored, so a hit means two nodes leaned on the same uncommon phrasing.
 *
 *   node pipeline/author/check-redundancy.mjs machine-learning
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2] ?? "machine-learning";
const dir = join(here, "batches", slug);

const content = {};
for (const f of readdirSync(dir).filter(
  (f) => f.endsWith(".json") && !f.startsWith("_") && !f.includes(".input."),
)) {
  Object.assign(content, JSON.parse(readFileSync(join(dir, f), "utf8")));
}

const STOP = new Set(
  `the a an and or but if then than that this these those of to in on for with
   as by at from is are was were be been being it its it's you your we our they
   their there here what when where why how which who whom while into over under
   about across after before between during without within one two three not no
   nor so such only own same too very can will just should now also more most
   less least much many few own each other another any all both some most
   model models data set sets training train trained learning learn learns
   feature features value values example examples point points use used using
   make makes made get gets got give gives given take takes taken work works
   worked need needs needed want wants like likes case cases time times way ways
   thing things does do did doing done have has had having`
    .split(/\s+/)
    .filter(Boolean),
);

/** Rare-ish content terms in a node, as a set. */
function terms(node) {
  const words = `${node.text} ${node.deep_text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP.has(w));
  return new Set(words);
}

const ids = Object.keys(content);
const sets = new Map(ids.map((id) => [id, terms(content[id])]));

// Document frequency: a term in many nodes is topic vocabulary, not a signal.
const df = new Map();
for (const s of sets.values())
  for (const w of s) df.set(w, (df.get(w) ?? 0) + 1);

const RARE = Math.max(2, Math.ceil(ids.length * 0.06));

const pairs = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = sets.get(ids[i]);
    const b = sets.get(ids[j]);
    const shared = [...a].filter((w) => b.has(w) && df.get(w) <= RARE);
    if (shared.length >= 6)
      pairs.push({ a: ids[i], b: ids[j], n: shared.length, shared });
  }
}

pairs.sort((x, y) => y.n - x.n);
if (!pairs.length) {
  console.log(`no cross-node redundancy above threshold (${ids.length} nodes)`);
} else {
  console.log(`${pairs.length} node pairs share rare vocabulary:\n`);
  for (const p of pairs.slice(0, 20))
    console.log(`  ${p.n}  ${p.a}  <->  ${p.b}\n      ${p.shared.slice(0, 12).join(", ")}`);
}
