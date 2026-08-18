# pipeline/

Local-only automation pipeline (PRD §4/§5). Not deployed — runs on the operator's machine.

```
author/     scope -> outline -> structure -> content-fill agent chain: pathway name -> full Topic JSON
generate/   LLM content generation → writes Node JSON into content/
capture/    screen-record a node's live page, scroll-synced
avatar/     avatar render (narration from on-page text) + local ffmpeg PIP compositing
upload/     YouTube Data API upload; Instagram/Meta Graph API cross-post
backfill/   writes youtube_video_id + status back onto the Node JSON in content/
lib/        content/ loader shared by the stages above
run.ts      per-node orchestrator: capture -> avatar -> upload -> backfill
```

Run order per pathway/node: `author` → (site deploy) → `capture` → `avatar` → `upload` →
`backfill`, or just `pnpm --filter @kbforge/pipeline run <nodeId>` to run the last four
stages end to end. `capture/` depends on `apps/web` already serving the target node —
see PRD §4.

### author/

`pnpm --filter @kbforge/pipeline author "<pathway name>"` runs the full authoring chain
for a new topic/pathway (e.g. "Frontend Development", "Backend Development") and writes
`content/topics/<slug>.json`:

1. `scope.ts` — LLM call: defines audience, summary, and explicit out-of-scope boundaries.
2. `outline.ts` — LLM call: headings/subheadings/subtopics (sections → subsections → units).
3. `structure.ts` — pure function: turns the outline into the final Node tree shape (ids,
   levels, empty text) — no LLM call, this is the "planning agent" step.
4. `content.ts` — walks the structured tree depth-first, reusing `generate/`'s
   `generateNode` to fill in each node's `text`, parent-context-first.

Each stage takes an optional `ContentProvider` (defaults to `NemotronProvider`), so the
whole chain shares the same `NVIDIA_API_KEY` gating as `generate/`.

## Credentials (not yet configured — PRD §6 M1/M2)

- `NVIDIA_API_KEY` — build.nvidia.com, Nemotron content generation.
- `HEYGEN_API_KEY` — avatar render.
- `YOUTUBE_*` — YouTube Data API OAuth credentials.
- `META_*` — Instagram/Meta Graph API credentials.

Until these exist, `upload/` and `avatar/` stages are stubbed (see each module's `index.ts`).
