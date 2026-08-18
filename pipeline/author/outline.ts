import type { ContentProvider } from "../generate/provider.ts";
import { NemotronProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
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

function prompt(scope: Scope): string {
  return [
    `Produce an outline of headings, subheadings, and subtopics for the "${scope.title}" pathway.`,
    `Audience: ${scope.audience}`,
    `Summary: ${scope.summary}`,
    `Out of scope: ${scope.boundaries.join("; ")}`,
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    `{"sections": [{"title": string, "subsections": [{"title": string, "units": [{"title": string}]}]}]}`,
    "- sections: 3-6 major sections covering the pathway top to bottom, in learning order.",
    "- subsections: 2-5 per section.",
    "- units: 2-5 atomic, concrete concepts per subsection — each should be teachable in one short video.",
  ].join("\n");
}

export async function buildOutline(
  scope: Scope,
  provider: ContentProvider = new NemotronProvider(),
): Promise<Outline> {
  return completeJson<Outline>(provider, prompt(scope));
}
