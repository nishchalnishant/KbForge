import type { Node, NodeContract } from "@kbforge/content-types";
import type { ContentProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
import { mapPool, defaultConcurrency } from "./concurrency.ts";
import { levels } from "./structure.ts";
import type { Scope } from "./scope.ts";

interface ContractAssignment {
  assignments: { title: string; must_cover: string; must_not_cover: string[] }[];
}

/**
 * Stage 3b — coverage contracts.
 *
 * Writing each node with only its parent's text as context is why sibling nodes
 * end up re-explaining the same material: nothing tells the "Gradient Descent"
 * node that a sibling already owns backpropagation. One call per parent assigns
 * all its children a boundary at once, which is both cheaper and more coherent
 * than asking each child to guess.
 */
export async function assignContracts(
  root: Node,
  scope: Scope,
  provider: ContentProvider,
  log: (msg: string) => void = () => {},
): Promise<void> {
  const parents = levels(root)
    .flat()
    .filter((n) => n.children.length > 0);

  if (parents.length === 0) return;
  log(`assigning contracts for ${parents.length} parent nodes...`);

  await mapPool(parents, defaultConcurrency(), async (parent) => {
    const siblingTitles = parent.children.map((c) => c.title);

    const result = await completeJson<ContractAssignment>(
      provider,
      [
        `Pathway: "${scope.title}". Audience: ${scope.audience}`,
        `Out of scope for the whole pathway: ${scope.boundaries.join("; ")}`,
        "",
        `The node "${parent.title}" (level: ${parent.level}) splits into these children, in order:`,
        ...siblingTitles.map((t, i) => `${i + 1}. ${t}`),
        "",
        "Assign each child a coverage contract so that together they cover the parent without",
        "overlapping each other. Every child must own a distinct slice.",
        "",
        "Respond with strict JSON only, no markdown fences, matching this shape:",
        `{"assignments": [{"title": string, "must_cover": string, "must_not_cover": string[]}]}`,
        "- title: must match the child title exactly as given above.",
        "- must_cover: one sentence naming the specific thing this child is responsible for teaching.",
        "- must_not_cover: 1-4 short strings naming material owned by a SIBLING, which this child",
        "  may mention in passing but must not explain. Use the sibling's own words where possible.",
      ].join("\n"),
      {
        temperature: 0.2,
        maxTokens: 2000,
        validate: (v) => {
          const a = v as Partial<ContractAssignment> | null;
          if (!a || !Array.isArray(a.assignments)) return "assignments must be an array";
          if (a.assignments.length === 0) return "assignments must not be empty";
          return null;
        },
      },
    );

    const byTitle = new Map<string, NodeContract>();
    for (const a of result.assignments) {
      if (typeof a?.title !== "string") continue;
      byTitle.set(normalise(a.title), {
        must_cover: String(a.must_cover ?? "").trim(),
        must_not_cover: Array.isArray(a.must_not_cover) ? a.must_not_cover.map(String) : [],
      });
    }

    for (const child of parent.children) {
      const contract = byTitle.get(normalise(child.title));
      // Fall back to a contract derived from sibling titles rather than leaving
      // the node unconstrained — an unmatched title shouldn't silently
      // reintroduce the overlap problem this stage exists to solve.
      child.contract = contract ?? {
        must_cover: child.title,
        must_not_cover: siblingTitles.filter((t) => t !== child.title),
      };
    }
  });
}

function normalise(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
