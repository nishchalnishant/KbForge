import type { Node, NodeVerification, VerificationIssue } from "@kbforge/content-types";
import type { ContentProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
import { mapPool, defaultConcurrency } from "./concurrency.ts";
import { levels } from "./structure.ts";
import type { Scope } from "./scope.ts";

export interface VerifyOptions {
  provider: ContentProvider;
  scope: Scope;
  concurrency?: number;
  /** Re-check nodes that already have a verification record. */
  force?: boolean;
  onNodeVerified?: (node: Node) => Promise<void> | void;
  log?: (msg: string) => void;
}

export interface VerifySummary {
  checked: number;
  passed: number;
  flagged: number;
  /** Node ids a human needs to look at, with their blocker issues. */
  needsReview: { id: string; title: string; issues: VerificationIssue[] }[];
}

interface CheckResponse {
  issues: { severity: string; detail: string }[];
}

/**
 * Stage 5 — verification.
 *
 * The PRD's plan is "human review before publish (light touch)". At four nodes
 * per topic that's fine; at sixty-five across twenty topics it is the entire
 * bottleneck, and it's the step most likely to get skipped under pressure —
 * which is exactly how a factually wrong explanation ships.
 *
 * Three checks run per node. Only nodes that fail one reach a human, which
 * turns "review 65 nodes" into "review the 9 flagged ones". That is the
 * difference between the human gate surviving scale and quietly not happening.
 */
export async function verifyTree(root: Node, opts: VerifyOptions): Promise<VerifySummary> {
  const { provider, scope, force = false, onNodeVerified, log = () => {} } = opts;
  const width = opts.concurrency ?? defaultConcurrency();

  const all = levels(root).flat();
  const parentOf = new Map<string, Node>();
  const walkParents = (node: Node) => {
    for (const child of node.children) {
      parentOf.set(child.id, node);
      walkParents(child);
    }
  };
  walkParents(root);

  const byLevel = new Map<string, Node[]>();
  for (const node of all) {
    const bucket = byLevel.get(node.level) ?? [];
    bucket.push(node);
    byLevel.set(node.level, bucket);
  }

  const targets = all.filter((n) => n.text.trim() && (force || !n.verification));
  log(`verifying ${targets.length}/${all.length} node(s), ${width} at a time`);

  const summary: VerifySummary = { checked: 0, passed: 0, flagged: 0, needsReview: [] };

  await mapPool(targets, width, async (node) => {
    const parent = parentOf.get(node.id) ?? null;
    const neighbours = pickNeighbours(node, parent, byLevel.get(node.level) ?? []);

    const [facts, duplication, contract] = await Promise.all([
      runCheck(provider, "facts", factsPrompt(node, scope)),
      neighbours.length
        ? runCheck(provider, "duplication", duplicationPrompt(node, neighbours))
        : Promise.resolve<VerificationIssue[]>([]),
      node.contract
        ? runCheck(provider, "contract", contractPrompt(node))
        : Promise.resolve<VerificationIssue[]>([]),
    ]);

    const issues = [...facts, ...duplication, ...contract];
    const passed = !issues.some((i) => i.severity === "blocker");

    const verification: NodeVerification = {
      checked_at: new Date().toISOString(),
      passed,
      issues,
    };
    node.verification = verification;
    node.needs_review = !passed;

    summary.checked++;
    if (passed) summary.passed++;
    else {
      summary.flagged++;
      summary.needsReview.push({
        id: node.id,
        title: node.title,
        issues: issues.filter((i) => i.severity === "blocker"),
      });
    }

    await onNodeVerified?.(node);
  });

  return summary;
}

async function runCheck(
  provider: ContentProvider,
  check: VerificationIssue["check"],
  prompt: string,
): Promise<VerificationIssue[]> {
  try {
    const res = await completeJson<CheckResponse>(provider, prompt, {
      temperature: 0.1,
      maxTokens: 1200,
      validate: (v) => {
        const r = v as Partial<CheckResponse> | null;
        if (!r || !Array.isArray(r.issues)) return "issues must be an array";
        return null;
      },
    });
    return res.issues
      .filter((i) => i && typeof i.detail === "string" && i.detail.trim())
      .map((i) => ({
        check,
        severity: i.severity === "blocker" ? "blocker" : "warning",
        detail: i.detail.trim(),
      }));
  } catch (err) {
    // A check that cannot run is itself worth a human's attention — failing
    // open silently would defeat the point of the stage.
    return [
      {
        check,
        severity: "warning",
        detail: `check could not be completed: ${(err as Error).message}`,
      },
    ];
  }
}

function factsPrompt(node: Node, scope: Scope): string {
  return [
    `You are fact-checking educational content in the "${scope.title}" pathway.`,
    "Your job is to REFUTE, not to approve. Assume there is an error and go looking for it.",
    "If you are uncertain whether something is correct, raise it — a false alarm is cheap,",
    "a wrong explanation shipped to learners is not.",
    "",
    `Title: ${node.title}`,
    `Short text: ${node.text}`,
    node.deep_text ? `Deep text: ${node.deep_text}` : "",
    node.interview?.length
      ? `Interview answers: ${node.interview.map((q) => `Q: ${q.question} A: ${q.answer}`).join(" | ")}`
      : "",
    "",
    "Look specifically for: factual errors, outdated claims, misleading simplifications,",
    "worked examples that don't actually work, and confidently stated things that are",
    "contested in the field.",
    "",
    "Respond with strict JSON only, no markdown fences:",
    `{"issues": [{"severity": "blocker" | "warning", "detail": string}]}`,
    "- blocker: a reader would come away believing something false.",
    "- warning: imprecise or debatable, but not wrong.",
    "- Return an empty issues array only if you genuinely found nothing.",
  ]
    .filter(Boolean)
    .join("\n");
}

function duplicationPrompt(node: Node, neighbours: Node[]): string {
  return [
    "You are checking whether a piece of educational content repeats material that a",
    "neighbouring node already covers. Each node should own a distinct slice.",
    "",
    `NODE UNDER REVIEW — ${node.title}`,
    node.text,
    "",
    "NEIGHBOURING NODES:",
    ...neighbours.map((n) => `--- ${n.title} ---\n${n.text}`),
    "",
    "Respond with strict JSON only, no markdown fences:",
    `{"issues": [{"severity": "blocker" | "warning", "detail": string}]}`,
    "- blocker: the node substantially re-explains a neighbour's material.",
    "- warning: some overlap, but each still earns its place.",
    "- Name the neighbour in the detail string.",
    "- Brief shared context or a one-line callback is normal and is not an issue.",
  ].join("\n");
}

function contractPrompt(node: Node): string {
  const contract = node.contract!;
  return [
    "You are checking a piece of content against the coverage contract it was written to.",
    "",
    `Title: ${node.title}`,
    `MUST cover: ${contract.must_cover}`,
    contract.must_not_cover.length
      ? `MUST NOT explain (a sibling owns these): ${contract.must_not_cover.join("; ")}`
      : "",
    "",
    `Short text: ${node.text}`,
    node.deep_text ? `Deep text: ${node.deep_text}` : "",
    "",
    "Respond with strict JSON only, no markdown fences:",
    `{"issues": [{"severity": "blocker" | "warning", "detail": string}]}`,
    "- blocker: the must-cover obligation is unmet, or a must-not-cover item is explained in depth.",
    "- warning: partially met, or a must-not-cover item is discussed more than in passing.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Siblings first (most likely overlap), then a couple of same-level nodes from
 * elsewhere in the tree — cross-branch repetition is the harder case to spot and
 * the one nobody checks for. Capped so cost stays linear in node count.
 */
function pickNeighbours(node: Node, parent: Node | null, sameLevel: Node[]): Node[] {
  const siblings = (parent?.children ?? []).filter((c) => c.id !== node.id && c.text.trim());
  const siblingIds = new Set(siblings.map((s) => s.id));

  const cousins = sameLevel
    .filter((n) => n.id !== node.id && !siblingIds.has(n.id) && n.text.trim())
    .sort((a, b) => titleOverlap(node.title, b.title) - titleOverlap(node.title, a.title))
    .slice(0, 2);

  return [...siblings.slice(0, 5), ...cousins];
}

function titleOverlap(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const wa = words(a);
  const wb = words(b);
  let n = 0;
  for (const w of wa) if (wb.has(w)) n++;
  return n;
}
