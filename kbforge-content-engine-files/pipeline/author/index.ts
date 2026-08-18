import type { Topic, TopicMeta } from "@kbforge/content-types";
import { resolveProviders, uniformProviders, type ContentProvider, type ProviderSet } from "../generate/provider.ts";
import { researchPathway, type ResearchBrief } from "./research.ts";
import { defineScope, type Scope } from "./scope.ts";
import { buildOutline } from "./outline.ts";
import { structureTopic, countNodes, levels } from "./structure.ts";
import { assignContracts } from "./contracts.ts";
import { fillContent } from "./content.ts";
import { verifyTree, type VerifySummary } from "./verify.ts";
import { extractReferences } from "./references.ts";
import { slugify } from "./slugify.ts";
import { createCheckpointer, graftExisting, loadAllTopics, loadTopic, saveTopic, topicPath } from "./store.ts";
import { defaultConcurrency } from "./concurrency.ts";

export interface AuthorOptions {
  /** Override the tiered provider set. Mostly for tests. */
  providers?: ProviderSet;
  /** Skip stage 0. Faster, but the outline reverts to the model's averaged prior. */
  skipResearch?: boolean;
  /** Skip stage 5. Only sensible for a throwaway run — see verify.ts. */
  skipVerify?: boolean;
  /** Re-write nodes that already have text instead of leaving them alone. */
  rewrite?: boolean;
  concurrency?: number;
  log?: (msg: string) => void;
}

export interface AuthorResult {
  topic: Topic;
  slug: string;
  path: string;
  nodeCount: number;
  verification?: VerifySummary;
}

/**
 * Seven-stage authoring chain.
 *
 *   0 research    ground the subject in how it's actually taught
 *   1 scope       audience, summary, explicit boundaries
 *   2 outline     3 framings -> 3 judges -> synthesis
 *   3 structure   deterministic tree + coverage contracts
 *   4 content     level-parallel fill, text + deep_text + interview
 *   5 verify      adversarial facts / duplication / contract
 *   6 references  cross-topic duplicates + prerequisite DAG (see authorReferences)
 *   7 store       checkpointed, resumable, atomic writes
 *
 * Re-running is cheap: content already on disk is grafted onto the fresh tree
 * and skipped, so an interrupted run resumes rather than restarting.
 */
export async function authorPathway(pathway: string, options: AuthorOptions = {}): Promise<AuthorResult> {
  const log = options.log ?? ((msg: string) => console.log(`[author] ${msg}`));
  const providers = options.providers ?? resolveProviders();
  const concurrency = options.concurrency ?? defaultConcurrency();

  // Stage 0 — research
  let research: ResearchBrief | undefined;
  if (options.skipResearch) {
    log("stage 0 research: skipped");
  } else {
    log(`stage 0 research: grounding "${pathway}"...`);
    research = await researchPathway(pathway, providers.reasoning);
    if (research.grounded) {
      log(`stage 0 research: ${research.sources.length} source(s)`);
    } else {
      log(
        "stage 0 research: NO SEARCH BACKEND CONFIGURED — running ungrounded on model recall. " +
          "Set TAVILY_API_KEY or BRAVE_API_KEY for a grounded outline.",
      );
    }
  }

  // Stage 1 — scope
  log(`stage 1 scope: defining scope for "${pathway}"...`);
  const scope: Scope = await defineScope(pathway, providers.reasoning, research);
  const slug = slugify(scope.title);

  // Stage 2 — outline (judge panel)
  log(`stage 2 outline: "${scope.title}"`);
  const outline = await buildOutline(scope, providers.reasoning, research, (m) => log(`stage 2 outline: ${m}`));

  // Stage 3 — structure + graft prior work
  const root = structureTopic(scope, outline);
  const total = countNodes(root);
  const unitCount = levels(root).flat().filter((n) => n.level === "unit").length;
  log(`stage 3 structure: ${total} node(s), ${unitCount} unit(s)`);

  const prior = loadTopic(slug);
  if (prior && !options.rewrite) {
    const grafted = graftExisting(root, prior.root);
    if (grafted) log(`stage 3 structure: reused ${grafted} previously written node(s)`);
  }

  const meta: TopicMeta = {
    title: scope.title,
    audience: scope.audience,
    summary: scope.summary,
    boundaries: scope.boundaries,
    research: research?.brief,
    sources: research?.sources,
    authored_at: new Date().toISOString(),
  };
  const topic: Topic = { root, meta };
  saveTopic(slug, topic);

  const checkpoint = createCheckpointer(slug, topic);

  try {
    // Stage 3b — contracts
    await assignContracts(root, scope, providers.standard, (m) => log(`stage 3 contracts: ${m}`));
    checkpoint.touch();

    // Stage 4 — content
    await fillContent(root, {
      provider: providers.fast,
      scope,
      research,
      concurrency,
      skipExisting: !options.rewrite,
      onNodeFilled: () => checkpoint.touch(),
      log: (m) => log(`stage 4 content: ${m}`),
    });
    checkpoint.flush();

    // Stage 5 — verify
    let verification: VerifySummary | undefined;
    if (options.skipVerify) {
      log("stage 5 verify: skipped");
    } else {
      verification = await verifyTree(root, {
        provider: providers.reasoning,
        scope,
        concurrency,
        force: options.rewrite,
        onNodeVerified: () => checkpoint.touch(),
        log: (m) => log(`stage 5 verify: ${m}`),
      });
      checkpoint.flush();
      log(
        `stage 5 verify: ${verification.passed}/${verification.checked} passed, ` +
          `${verification.flagged} need review`,
      );
      for (const item of verification.needsReview) {
        log(`  ⚑ ${item.id} — ${item.issues.map((i) => `[${i.check}] ${i.detail}`).join(" | ")}`);
      }
    }

    log(`wrote ${topicPath(slug)}`);
    return { topic, slug, path: topicPath(slug), nodeCount: total, verification };
  } finally {
    checkpoint.flush();
  }
}

/**
 * Stage 6, run across the whole catalogue rather than per-topic — duplicates and
 * prerequisites are cross-topic by nature, so this only makes sense once more
 * than one topic exists.
 */
export async function authorReferences(options: AuthorOptions = {}): Promise<void> {
  const log = options.log ?? ((msg: string) => console.log(`[references] ${msg}`));
  const providers = options.providers ?? resolveProviders();

  const topics = loadAllTopics();
  if (topics.length < 2) {
    log("fewer than 2 topics on disk — nothing to cross-reference");
    return;
  }

  const report = await extractReferences(topics, {
    provider: providers.reasoning,
    concurrency: options.concurrency ?? defaultConcurrency(),
    log: (m) => log(m),
  });

  for (const topic of topics) saveTopic(topic.root.id, topic);

  log(`${report.duplicates.length} duplicate concept pair(s):`);
  for (const d of report.duplicates) log(`  ${d.a} ≡ ${d.b} — ${d.reason}`);
  log(`${report.prerequisites.length} node(s) given prerequisites`);
}

/** Back-compat: run the chain with a single provider for every tier. */
export async function authorPathwayWithProvider(pathway: string, provider: ContentProvider): Promise<AuthorResult> {
  return authorPathway(pathway, { providers: uniformProviders(provider) });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.filter((a) => !a.startsWith("--"));

  const run = async () => {
    if (flags.has("--references")) {
      await authorReferences();
      return;
    }

    const pathway = positional[0];
    if (!pathway) {
      console.error(
        [
          'Usage: tsx author/index.ts "<pathway name>" [flags]',
          "       tsx author/index.ts --references",
          "",
          "Flags:",
          "  --rewrite        re-write nodes that already have text (default: resume)",
          "  --skip-research  skip stage 0 grounding",
          "  --skip-verify    skip stage 5 verification",
          "  --references     cross-topic duplicate + prerequisite extraction",
        ].join("\n"),
      );
      process.exit(1);
    }

    await authorPathway(pathway, {
      rewrite: flags.has("--rewrite"),
      skipResearch: flags.has("--skip-research"),
      skipVerify: flags.has("--skip-verify"),
    });
  };

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
