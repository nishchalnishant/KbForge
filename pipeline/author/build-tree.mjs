/**
 * Expands an authored outline JSON into a full Node tree with stable ids,
 * correct levels and sibling-derived contracts, then writes the skeleton
 * topic file. Content fill happens separately, node by node.
 *
 * Levels follow the schema: topic > section > subsection > unit. Anything
 * nested below a subsection stays "unit" — depth can exceed four, but the
 * level vocabulary does not.
 *
 *   node pipeline/author/build-tree.mjs machine-learning
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node build-tree.mjs <topic-slug>");
  process.exit(1);
}

const outline = JSON.parse(readFileSync(join(here, "outlines", `${slug}.outline.json`), "utf8"));

const seen = new Set();
function slugify(title) {
  const base = title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  let id = base;
  let n = 2;
  while (seen.has(id)) id = `${base}-${n++}`;
  seen.add(id);
  return id;
}

/** Children of a node in the outline, whichever key the level uses. */
function kidsOf(n) {
  return n.subsections ?? n.units ?? [];
}

function build(raw, level) {
  const kids = kidsOf(raw);
  const node = {
    id: slugify(raw.title),
    level,
    title: raw.title,
    text: "",
    status: "text_only",
    children: [],
  };
  // Below subsection, everything is a unit regardless of nesting depth.
  const childLevel =
    level === "topic" ? "section" : level === "section" ? "subsection" : "unit";
  node.children = kids.map((k) => build(k, childLevel));
  return node;
}

const root = {
  id: slugify(outline.title),
  level: "topic",
  title: outline.title,
  text: "",
  status: "text_only",
  children: outline.sections.map((s) => build(s, "section")),
};

/**
 * Contracts: a node must cover its own title's material and must not explain
 * anything a sibling owns. Sibling titles are the cheapest accurate proxy for
 * "material someone else owns", and it is exactly the redundancy that shows up
 * when each node is written knowing only its parent.
 */
function assignContracts(node, siblings) {
  const others = siblings.filter((s) => s.id !== node.id).map((s) => s.title);
  node.contract = {
    must_cover: node.title,
    must_not_cover: others,
  };
  for (const c of node.children) assignContracts(c, node.children);
}
for (const s of root.children) assignContracts(s, root.children);
root.contract = { must_cover: root.title, must_not_cover: [] };

const topic = {
  root,
  meta: {
    title: outline.title,
    audience: outline.audience,
    summary: outline.summary,
    boundaries: outline.boundaries,
    authored_at: new Date().toISOString(),
  },
};

let counts = { total: 0, byLevel: {}, leaves: 0 };
(function count(n) {
  counts.total++;
  counts.byLevel[n.level] = (counts.byLevel[n.level] ?? 0) + 1;
  if (n.children.length === 0) counts.leaves++;
  n.children.forEach(count);
})(root);

const out = join(repo, "content", "topics", `${slug}.json`);
const skeleton = join(here, "outlines", `${slug}.skeleton.json`);
writeFileSync(skeleton, JSON.stringify(topic, null, 2) + "\n");
if (!existsSync(out) || process.argv.includes("--write")) {
  writeFileSync(out, JSON.stringify(topic, null, 2) + "\n");
}

console.log(`${outline.title}: ${counts.total} nodes (${counts.leaves} leaves)`);
console.log(counts.byLevel);
console.log(`skeleton -> ${skeleton}`);
