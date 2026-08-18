import type { Node, Topic } from "@kbforge/content-types";
import type { ContentProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
import { mapPool, defaultConcurrency } from "./concurrency.ts";
import { levels } from "./structure.ts";

export interface ReferenceOptions {
  provider: ContentProvider;
  concurrency?: number;
  log?: (msg: string) => void;
}

export interface ReferenceReport {
  /** Confirmed duplicate concepts, written onto both nodes as `same_as`. */
  duplicates: { a: string; b: string; reason: string }[];
  /** Prerequisite edges written onto nodes as `prerequisites`. */
  prerequisites: { node: string; requires: string[] }[];
}

interface Candidate {
  id: string;
  title: string;
  text: string;
  topicId: string;
}

/**
 * Stage 6 — reference and prerequisite extraction.
 *
 * PRD §3 wants one node to render inside several trees, and M3 is written as a
 * manual cross-referencing exercise. Over 1,300 nodes that is not a task anyone
 * completes. This derives both the many-to-many links and a prerequisite DAG
 * from the content that already exists.
 *
 * Lexical prefilter first, LLM confirmation second: comparing every pair is
 * quadratic and most pairs are obviously unrelated.
 */
export async function extractReferences(topics: Topic[], opts: ReferenceOptions): Promise<ReferenceReport> {
  const { provider, log = () => {} } = opts;
  const width = opts.concurrency ?? defaultConcurrency();

  const nodes: Candidate[] = topics.flatMap((t) =>
    levels(t.root)
      .flat()
      .filter((n) => n.text.trim())
      .map((n) => ({ id: n.id, title: n.title, text: n.text, topicId: t.root.id })),
  );
  const byId = new Map<string, Node>();
  for (const topic of topics) {
    for (const node of levels(topic.root).flat()) byId.set(node.id, node);
  }

  log(`scanning ${nodes.length} node(s) across ${topics.length} topic(s)`);

  // --- duplicates -----------------------------------------------------------
  const pairs = candidatePairs(nodes).slice(0, 200);
  log(`${pairs.length} candidate duplicate pair(s) after lexical prefilter`);

  const duplicates: ReferenceReport["duplicates"] = [];
  await mapPool(pairs, width, async ([a, b]) => {
    const verdict = await completeJson<{ same: boolean; reason: string }>(
      provider,
      [
        "Two nodes from a technical learning site. Decide whether they teach substantially",
        "the SAME concept, such that one page could serve both places.",
        "",
        `--- A (${a.id}) ${a.title} ---\n${a.text}`,
        "",
        `--- B (${b.id}) ${b.title} ---\n${b.text}`,
        "",
        "Respond with strict JSON only, no markdown fences:",
        `{"same": boolean, "reason": string}`,
        "- same: true only if merging them would lose nothing. Related-but-distinct is false.",
      ].join("\n"),
      {
        temperature: 0.1,
        maxTokens: 500,
        validate: (v) => (typeof (v as { same?: unknown })?.same === "boolean" ? null : "same must be a boolean"),
      },
    ).catch(() => ({ same: false, reason: "" }));

    if (!verdict.same) return;
    duplicates.push({ a: a.id, b: b.id, reason: verdict.reason });
    link(byId.get(a.id), b.id);
    link(byId.get(b.id), a.id);
  });

  // --- prerequisites --------------------------------------------------------
  const units = nodes.filter((n) => byId.get(n.id)?.level === "unit");
  log(`deriving prerequisites for ${units.length} unit(s)`);

  const prerequisites: ReferenceReport["prerequisites"] = [];
  await mapPool(units, width, async (unit) => {
    const pool = relevantOthers(unit, nodes).slice(0, 30);
    if (pool.length === 0) return;

    const result = await completeJson<{ prerequisites: string[] }>(
      provider,
      [
        `Which of the following concepts must a reader already understand before "${unit.title}"?`,
        "",
        `Concept under review:\n${unit.text}`,
        "",
        "Candidates (id — title):",
        ...pool.map((c) => `${c.id} — ${c.title}`),
        "",
        "Respond with strict JSON only, no markdown fences:",
        `{"prerequisites": string[]}`,
        "- Use ids exactly as listed. Return at most 4.",
        "- Only genuine hard prerequisites — things the explanation would be incoherent without.",
        "- An empty array is a perfectly good answer.",
      ].join("\n"),
      {
        temperature: 0.1,
        maxTokens: 600,
        validate: (v) =>
          Array.isArray((v as { prerequisites?: unknown })?.prerequisites)
            ? null
            : "prerequisites must be an array",
      },
    ).catch(() => ({ prerequisites: [] as string[] }));

    const valid = result.prerequisites.filter((id) => byId.has(id) && id !== unit.id).slice(0, 4);
    if (valid.length === 0) return;

    const node = byId.get(unit.id);
    if (node) node.prerequisites = valid;
    prerequisites.push({ node: unit.id, requires: valid });
  });

  return { duplicates, prerequisites };
}

function link(node: Node | undefined, otherId: string): void {
  if (!node) return;
  const set = new Set(node.same_as ?? []);
  set.add(otherId);
  node.same_as = [...set];
}

/** Pairs sharing enough distinctive title words to be worth an LLM call. */
function candidatePairs(nodes: Candidate[]): [Candidate, Candidate][] {
  const pairs: { pair: [Candidate, Candidate]; score: number }[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (a.topicId === b.topicId) continue; // same tree — structure already separates them
      const score = jaccard(tokens(a.title), tokens(b.title));
      if (score >= 0.5) pairs.push({ pair: [a, b], score });
    }
  }

  return pairs.sort((x, y) => y.score - x.score).map((p) => p.pair);
}

function relevantOthers(unit: Candidate, nodes: Candidate[]): Candidate[] {
  const target = tokens(`${unit.title} ${unit.text}`);
  return nodes
    .filter((n) => n.id !== unit.id)
    .map((n) => ({ n, score: jaccard(target, tokens(n.title)) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.n);
}

function tokens(s: string): Set<string> {
  const stop = new Set(["with", "from", "that", "this", "into", "your", "what", "when", "using", "does", "then"]);
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !stop.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of b) if (a.has(w)) shared++;
  return shared / new Set([...a, ...b]).size;
}
