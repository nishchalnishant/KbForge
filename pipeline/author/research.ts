import type { ContentProvider } from "../generate/provider.ts";
import { mapPoolSettled } from "./concurrency.ts";
import { resolveSearchProvider, type SearchProvider, type SearchResult } from "./search.ts";

export interface ResearchBrief {
  /** Prose brief handed to every downstream stage. */
  brief: string;
  /** URLs the brief was built from. Empty when running ungrounded. */
  sources: string[];
  /** False when no search backend was configured. */
  grounded: boolean;
}

/**
 * Stage 0 — grounding.
 *
 * Looks at how the subject is actually taught (canonical syllabi, official
 * documentation, standard curricula) before anything decides on a structure.
 * Everything downstream — scope, outline, contracts, content — reads this.
 */
export async function researchPathway(
  pathway: string,
  provider: ContentProvider,
  search: SearchProvider = resolveSearchProvider(),
): Promise<ResearchBrief> {
  const queries = [
    `${pathway} university course syllabus outline`,
    `${pathway} official documentation table of contents`,
    `${pathway} curriculum core topics list`,
    `${pathway} what practitioners actually need to know`,
  ];

  const settled = await mapPoolSettled(queries, 4, (q) => search.search(q, 5));
  const results: SearchResult[] = settled.flatMap((s) => (s.ok ? s.value : []));

  if (results.length === 0) {
    const brief = await provider.generateNodeContent(
      [
        `Describe how the subject "${pathway}" is conventionally taught.`,
        "Cover: the standard progression of topics, which concepts are universally treated as",
        "foundational, which are commonly taught but arguably optional, and where curricula",
        "typically disagree with each other.",
        "Write 200-350 words of plain prose. No headings, no bullet points.",
      ].join("\n"),
      { temperature: 0.3, maxTokens: 900 },
    );
    return { brief: brief.trim(), sources: [], grounded: false };
  }

  const deduped = dedupeByUrl(results).slice(0, 14);
  const corpus = deduped
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
    .join("\n\n");

  const brief = await provider.generateNodeContent(
    [
      `You are preparing a grounding brief for a technical learning pathway on "${pathway}".`,
      "Below are search results from syllabi, documentation and curricula.",
      "",
      corpus,
      "",
      "Write a 250-400 word brief covering:",
      "- the progression of topics these sources agree on",
      "- concepts treated as foundational everywhere",
      "- concepts that appear in only some sources (and are therefore optional)",
      "- anything the sources suggest is commonly taught but outdated in practice",
      "Plain prose, no headings or bullets. Base it on the sources, not on general impressions.",
    ].join("\n"),
    { temperature: 0.3, maxTokens: 1200 },
  );

  return {
    brief: brief.trim(),
    sources: deduped.map((r) => r.url).filter(Boolean),
    grounded: true,
  };
}

function dedupeByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = r.url || r.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}
