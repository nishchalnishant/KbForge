import type { ContentProvider } from "../generate/provider.ts";
import { NemotronProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";
import type { ResearchBrief } from "./research.ts";

export interface Scope {
  title: string;
  audience: string;
  summary: string;
  boundaries: string[];
}

function prompt(pathway: string, research?: ResearchBrief): string {
  return [
    `You are defining the scope of a technical learning pathway titled "${pathway}".`,
    research ? `Grounding brief on how this subject is actually taught:\n${research.brief}\n` : "",
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    `{"title": string, "audience": string, "summary": string, "boundaries": string[]}`,
    "- title: a clean, canonical title for the pathway.",
    "- audience: who this pathway is for and what they should already know.",
    "- summary: 2-4 sentences describing what the pathway covers end to end.",
    "- boundaries: 3-6 bullet strings on what is explicitly OUT of scope, to keep the pathway focused.",
    research ? "Use the brief to set boundaries — prefer excluding material the sources treat as optional." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function defineScope(
  pathway: string,
  provider: ContentProvider = new NemotronProvider(),
  research?: ResearchBrief,
): Promise<Scope> {
  return completeJson<Scope>(provider, prompt(pathway, research), {
    temperature: 0.3,
    validate: (v) => {
      const s = v as Partial<Scope> | null;
      if (!s || typeof s.title !== "string" || !s.title.trim()) return "title must be a non-empty string";
      if (typeof s.audience !== "string") return "audience must be a string";
      if (typeof s.summary !== "string") return "summary must be a string";
      if (!Array.isArray(s.boundaries)) return "boundaries must be an array of strings";
      return null;
    },
  });
}
