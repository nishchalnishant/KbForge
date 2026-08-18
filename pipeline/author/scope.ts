import type { ContentProvider } from "../generate/provider.ts";
import { NemotronProvider } from "../generate/provider.ts";
import { completeJson } from "./json-completion.ts";

export interface Scope {
  title: string;
  audience: string;
  summary: string;
  boundaries: string[];
}

function prompt(pathway: string): string {
  return [
    `You are defining the scope of a technical learning pathway titled "${pathway}".`,
    "Respond with strict JSON only, no markdown fences, matching this shape:",
    `{"title": string, "audience": string, "summary": string, "boundaries": string[]}`,
    "- title: a clean, canonical title for the pathway.",
    "- audience: who this pathway is for and what they should already know.",
    "- summary: 2-4 sentences describing what the pathway covers end to end.",
    "- boundaries: 3-6 bullet strings on what is explicitly OUT of scope, to keep the pathway focused.",
  ].join("\n");
}

export async function defineScope(
  pathway: string,
  provider: ContentProvider = new NemotronProvider(),
): Promise<Scope> {
  return completeJson<Scope>(provider, prompt(pathway));
}
