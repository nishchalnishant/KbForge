import type { ContentProvider } from "../generate/provider.ts";
import { NemotronProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
import { mapPool } from "./concurrency.ts";
import type { ResearchBrief } from "./research.ts";
import type { Scope } from "./scope.ts";

export interface OutlineUnit {
  title: string;
}

export interface OutlineSubsection {
  title: string;
  units: OutlineUnit[];
}

export interface OutlineSection {
  title: string;
  subsections: OutlineSubsection[];
}

export interface Outline {
  sections: OutlineSection[];
}

/**
 * Three deliberately different ways to carve up the same subject. Sampling the
 * same prompt three times gives three near-identical trees; changing the
 * organising principle gives genuinely different ones, which is what makes the
 * judging step worth anything.
 */
const FRAMINGS = [
  {
    key: "first-principles",
    instruction:
      "Organise from first principles: start with the irreducible ideas the rest depends on, " +
      "and let each section build strictly on the ones before it. Optimise for a reader who " +
      "wants to understand why things are the way they are.",
  },
  {
    key: "job-task",
    instruction:
      "Organise around what a practitioner actually does day to day. Sections should map to " +
      "real tasks and decisions, not to academic categories. Optimise for a reader who needs " +
      "to be useful on the job quickly.",
  },
  {
    key: "interview-driven",
    instruction:
      "Organise around what gets probed in technical interviews and design reviews — the " +
      "concepts people are expected to be able to explain out loud. Optimise for a reader " +
      "preparing to be questioned on this material.",
  },
] as const;

/** Lenses for the judge panel. Diverse criteria beat three copies of "is this good?". */
const JUDGE_LENSES = [
  {
    key: "coverage",
    instruction:
      "Judge purely on coverage: does the outline cover the subject as the grounding brief " +
      "describes it, without straying past the stated boundaries? Penalise both gaps and scope creep.",
  },
  {
    key: "learning-order",
    instruction:
      "Judge purely on sequencing: can a reader move top to bottom without hitting a concept " +
      "that depends on something introduced later? Penalise forward references hard.",
  },
  {
    key: "atomicity",
    instruction:
      "Judge purely on unit atomicity: is each unit ONE concept, explainable in under a minute " +
      "and recordable as one short video? Penalise units that are really three topics in a trenchcoat, " +
      "and units too trivial to deserve their own page.",
  },
] as const;

interface JudgeVerdict {
  scores: { candidate: number; score: number; reason: string }[];
  best: number;
  /** Specific things worth stealing from the candidates that didn't win. */
  salvage: string[];
}

function candidatePrompt(scope: Scope, framing: string, research?: ResearchBrief): string {
  return [
    `Produce an outline of sections, subsections and units for the "${scope.title}" pathway.`,
    `Audience: ${scope.audience}`,
    `Summary: ${scope.summary}`,
    `Out of scope: ${scope.boundaries.join("; ")}`,
    research ? `\nGrounding brief:\n${research.brief}\n` : "",
    `Organising principle for THIS outline: ${framing}`,
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    `{"sections": [{"title": string, "subsections": [{"title": string, "units": [{"title": string}]}]}]}`,
    "- sections: 3-6 major sections covering the pathway top to bottom, in learning order.",
    "- subsections: 2-5 per section.",
    "- units: 2-5 atomic, concrete concepts per subsection — each teachable in one short video.",
    "- Unit titles must name a specific concept, not a chapter heading.",
  ]
    .filter(Boolean)
    .join("\n");
}

function judgePrompt(scope: Scope, candidates: Outline[], lens: string, research?: ResearchBrief): string {
  const rendered = candidates
    .map((o, i) => `--- CANDIDATE ${i} ---\n${renderOutline(o)}`)
    .join("\n\n");

  return [
    `You are evaluating ${candidates.length} competing outlines for the "${scope.title}" pathway.`,
    `Audience: ${scope.audience}`,
    `Out of scope: ${scope.boundaries.join("; ")}`,
    research ? `\nGrounding brief:\n${research.brief}\n` : "",
    `Evaluation lens — apply ONLY this criterion: ${lens}`,
    "",
    rendered,
    "",
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    `{"scores": [{"candidate": number, "score": number, "reason": string}], "best": number, "salvage": string[]}`,
    "- score: 0-10 on your assigned lens only.",
    "- best: the index of the strongest candidate on your lens.",
    "- salvage: 2-5 specific sections/subsections/units from the candidates that did NOT win",
    "  which are strong enough that the final outline should absorb them. Name them exactly.",
  ]
    .filter(Boolean)
    .join("\n");
}

function synthesisPrompt(
  scope: Scope,
  winner: Outline,
  others: Outline[],
  salvage: string[],
  research?: ResearchBrief,
): string {
  return [
    `Produce the FINAL outline for the "${scope.title}" pathway.`,
    `Audience: ${scope.audience}`,
    `Out of scope: ${scope.boundaries.join("; ")}`,
    research ? `\nGrounding brief:\n${research.brief}\n` : "",
    "Start from this outline, which a judge panel scored highest:",
    renderOutline(winner),
    "",
    others.length ? `Other candidates considered:\n${others.map(renderOutline).join("\n\n")}` : "",
    "",
    salvage.length
      ? `The panel flagged these as worth absorbing from the losing candidates:\n- ${salvage.join("\n- ")}`
      : "",
    "",
    "Produce one merged outline: keep the winner's overall structure, fold in the salvaged items",
    "where they fit, remove any duplication the merge creates, and ensure no unit depends on a",
    "concept introduced later in the sequence.",
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    `{"sections": [{"title": string, "subsections": [{"title": string, "units": [{"title": string}]}]}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Stage 2 — outline via judge panel.
 *
 * The outline decides how the ~65 downstream content calls get spent, and a bad
 * shape cannot be repaired later. Three framings, three judges, one synthesis
 * costs about ten extra calls to avoid spending sixty-five on the wrong tree.
 */
export async function buildOutline(
  scope: Scope,
  provider: ContentProvider = new NemotronProvider(),
  research?: ResearchBrief,
  log: (msg: string) => void = () => {},
): Promise<Outline> {
  log(`generating ${FRAMINGS.length} candidate outlines...`);
  const candidates = await mapPool(FRAMINGS, FRAMINGS.length, (f) =>
    completeJson<Outline>(provider, candidatePrompt(scope, f.instruction, research), {
      temperature: 0.7,
      maxTokens: 3000,
      validate: validateOutline,
    }),
  );

  log(`judging with ${JUDGE_LENSES.length} lenses...`);
  const verdicts = await mapPool(JUDGE_LENSES, JUDGE_LENSES.length, (l) =>
    completeJson<JudgeVerdict>(provider, judgePrompt(scope, candidates, l.instruction, research), {
      temperature: 0.2,
      maxTokens: 2000,
      validate: (v) => {
        const j = v as Partial<JudgeVerdict> | null;
        if (!j || !Array.isArray(j.scores)) return "scores must be an array";
        if (typeof j.best !== "number") return "best must be a number";
        return null;
      },
    }),
  );

  const totals = candidates.map((_, i) =>
    verdicts.reduce((sum, v) => sum + (v.scores.find((s) => s.candidate === i)?.score ?? 0), 0),
  );
  const winnerIndex = totals.indexOf(Math.max(...totals));
  const salvage = verdicts.flatMap((v) => v.salvage ?? []).slice(0, 12);

  log(
    `panel scores ${totals.map((t, i) => `${FRAMINGS[i]!.key}=${t}`).join(" ")} → ` +
      `winner "${FRAMINGS[winnerIndex]!.key}", ${salvage.length} items salvaged`,
  );

  const others = candidates.filter((_, i) => i !== winnerIndex);
  return completeJson<Outline>(
    provider,
    synthesisPrompt(scope, candidates[winnerIndex]!, others, salvage, research),
    { temperature: 0.3, maxTokens: 4000, validate: validateOutline },
  );
}

export function validateOutline(value: unknown): string | null {
  const o = value as Partial<Outline> | null;
  if (!o || !Array.isArray(o.sections) || o.sections.length === 0) {
    return "sections must be a non-empty array";
  }
  for (const section of o.sections) {
    if (!section || typeof section.title !== "string" || !section.title.trim()) {
      return "every section needs a non-empty title";
    }
    if (!Array.isArray(section.subsections)) {
      return `section "${section.title}" needs a subsections array`;
    }
    for (const sub of section.subsections) {
      if (!sub || typeof sub.title !== "string" || !sub.title.trim()) {
        return `every subsection of "${section.title}" needs a non-empty title`;
      }
      if (!Array.isArray(sub.units)) {
        return `subsection "${sub.title}" needs a units array`;
      }
      for (const unit of sub.units) {
        if (!unit || typeof unit.title !== "string" || !unit.title.trim()) {
          return `every unit of "${sub.title}" needs a non-empty title`;
        }
      }
    }
  }
  return null;
}

function renderOutline(outline: Outline): string {
  return outline.sections
    .map(
      (s) =>
        `# ${s.title}\n` +
        s.subsections
          .map((ss) => `  ## ${ss.title}\n` + ss.units.map((u) => `    - ${u.title}`).join("\n"))
          .join("\n"),
    )
    .join("\n");
}
