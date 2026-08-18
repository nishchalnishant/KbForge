import type { InterviewQuestion, Node } from "@kbforge/content-types";
import type { ContentProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
import { mapPool, defaultConcurrency } from "./concurrency.ts";
import { levels } from "./structure.ts";
import type { ResearchBrief } from "./research.ts";
import type { Scope } from "./scope.ts";

export interface FillOptions {
  provider: ContentProvider;
  scope: Scope;
  research?: ResearchBrief;
  concurrency?: number;
  /** Leave already-written nodes alone. Makes a re-run cheap and resumable. */
  skipExisting?: boolean;
  /** Called after each node is filled — used to checkpoint to disk. */
  onNodeFilled?: (node: Node) => Promise<void> | void;
  log?: (msg: string) => void;
}

interface NodeDraft {
  text: string;
  deep_text: string;
  interview?: InterviewQuestion[];
}

/**
 * Stage 4 — content fill.
 *
 * Three changes from the depth-first version:
 *
 * - **Level-parallel.** The only real dependency is parent -> child; siblings
 *   are independent once the parent's text exists. Same call count, an order of
 *   magnitude less wall-clock.
 * - **Contract-aware.** Each node gets its coverage contract, its siblings'
 *   titles and the pathway boundaries, not just the parent's prose — so nodes
 *   stop re-explaining each other.
 * - **Two layers in one call.** `text` and `deep_text` are generated together
 *   because they must be consistent with each other, and one call is cheaper
 *   than two. This is what finally lights up LessonPanel's Short / Deep dive
 *   toggle, which has been reading `deep_text` that nothing ever wrote.
 */
export async function fillContent(root: Node, opts: FillOptions): Promise<Node> {
  const { provider, scope, research, skipExisting = false, onNodeFilled, log = () => {} } = opts;
  const width = opts.concurrency ?? defaultConcurrency();

  const parentOf = new Map<string, Node>();
  const walkParents = (node: Node) => {
    for (const child of node.children) {
      parentOf.set(child.id, node);
      walkParents(child);
    }
  };
  walkParents(root);

  const byLevel = levels(root);

  for (const [depth, nodes] of byLevel.entries()) {
    const pending = skipExisting ? nodes.filter((n) => !n.text.trim()) : nodes;
    if (pending.length === 0) {
      log(`depth ${depth}: ${nodes.length} node(s) already written, skipping`);
      continue;
    }
    log(`depth ${depth}: writing ${pending.length}/${nodes.length} node(s), ${width} at a time`);

    await mapPool(pending, width, async (node) => {
      const parent = parentOf.get(node.id) ?? null;
      const siblings = parent ? parent.children.filter((c) => c.id !== node.id).map((c) => c.title) : [];
      const childTitles = node.children.map((c) => c.title);

      const draft = await completeJson<NodeDraft>(
        provider,
        nodePrompt({ node, parent, siblings, childTitles, scope, research }),
        {
          temperature: 0.4,
          maxTokens: 2400,
          validate: (v) => {
            const d = v as Partial<NodeDraft> | null;
            if (!d) return "expected an object";
            if (typeof d.text !== "string" || d.text.trim().length < 40) {
              return "text must be a string of at least 40 characters";
            }
            if (typeof d.deep_text !== "string" || d.deep_text.trim().length < 100) {
              return "deep_text must be a string of at least 100 characters";
            }
            return null;
          },
        },
      );

      node.text = draft.text.trim();
      node.deep_text = draft.deep_text.trim();
      if (node.level === "unit" && Array.isArray(draft.interview) && draft.interview.length > 0) {
        node.interview = draft.interview
          .filter((q) => q && typeof q.question === "string" && typeof q.answer === "string")
          .slice(0, 3);
      }

      await onNodeFilled?.(node);
    });
  }

  return root;
}

function nodePrompt(args: {
  node: Node;
  parent: Node | null;
  siblings: string[];
  childTitles: string[];
  scope: Scope;
  research?: ResearchBrief;
}): string {
  const { node, parent, siblings, childTitles, scope, research } = args;
  const isUnit = node.level === "unit";

  const shape = isUnit
    ? [
        "This is a LEAF concept — nothing sits below it. Explain it atomically and concretely.",
        "- text: the short read. 3-5 sentences, under 120 words, understandable on its own.",
        "- deep_text: the long read. 250-400 words, including one concrete worked example",
        "  and one common misconception with the correction.",
        "- interview: exactly 3 questions this concept gets asked as in technical interviews,",
        "  each with a 2-3 sentence answer.",
      ]
    : [
        `This node has children — it is an OVERVIEW of what it splits into, not the depth of each child.`,
        `Its children are: ${childTitles.join("; ") || "(none yet)"}.`,
        "- text: the short read. 3-5 sentences, under 120 words, orienting the reader in what",
        "  this splits into and why it splits that way. Do not explain the children's material.",
        "- deep_text: the long read. 200-350 words on how the children relate to each other and",
        "  in what order they make sense. Still an overview — no worked examples.",
      ];

  return [
    `Write the content for a node in the "${scope.title}" learning pathway.`,
    `Audience: ${scope.audience}`,
    `Out of scope for the whole pathway: ${scope.boundaries.join("; ")}`,
    research ? `\nGrounding brief:\n${research.brief}\n` : "",
    "",
    `Node title: ${node.title}`,
    `Node level: ${node.level}`,
    parent ? `Parent node: "${parent.title}"\nParent text: ${parent.text}` : "",
    node.contract ? `\nThis node MUST cover: ${node.contract.must_cover}` : "",
    node.contract?.must_not_cover.length
      ? `This node MUST NOT explain (a sibling owns it): ${node.contract.must_not_cover.join("; ")}`
      : "",
    siblings.length ? `Sibling nodes at this level: ${siblings.join("; ")}` : "",
    "",
    ...shape,
    "",
    "Plain prose. No headings, no bullet points, no markdown inside the strings.",
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    isUnit
      ? `{"text": string, "deep_text": string, "interview": [{"question": string, "answer": string}]}`
      : `{"text": string, "deep_text": string}`,
  ]
    .filter(Boolean)
    .join("\n");
}
