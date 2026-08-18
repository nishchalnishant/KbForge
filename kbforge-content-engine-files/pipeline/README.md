# pipeline/

Local-only automation pipeline (PRD §4/§5). Not deployed — runs on the operator's machine.

```
author/     research -> scope -> outline -> structure -> contracts -> content ->
            verify -> references: pathway name -> full Topic JSON
generate/   LLM provider layer + the legacy single-node generator
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

---

## author/ — the content engine

```bash
pnpm --filter @kbforge/pipeline author "Frontend Development"
pnpm --filter @kbforge/pipeline author "Frontend Development" --rewrite
pnpm --filter @kbforge/pipeline references     # cross-topic pass, run after 2+ topics exist
pnpm --filter @kbforge/pipeline smoke          # end-to-end, no credentials, no network
```

Writes `content/topics/<slug>.json`.

### Stages

| # | Module | LLM | What it does |
|---|---|---|---|
| 0 | `research.ts` | reasoning | Searches syllabi/docs/curricula and writes a grounding brief every later stage reads. Without it the outline is the model's averaged prior over all internet content on the subject — i.e. the generic structure everyone already publishes. |
| 1 | `scope.ts` | reasoning | Audience, summary, explicit out-of-scope boundaries. |
| 2 | `outline.ts` | reasoning | **Judge panel.** Three outlines from different organising principles (first-principles / job-task / interview-driven), scored by three judges on separate lenses (coverage / learning order / atomicity), then synthesised with the best parts of the losers grafted in. |
| 3 | `structure.ts` | — | Deterministic tree build. Ids are deduplicated across the topic. |
| 3b | `contracts.ts` | standard | Assigns every node a `must_cover` / `must_not_cover` contract so siblings stop re-explaining each other. |
| 4 | `content.ts` | fast | Level-parallel fill. Writes `text`, `deep_text` and (for units) `interview` in one call. |
| 5 | `verify.ts` | reasoning | Three checks per node — adversarial fact-check, duplication against siblings and cousins, contract compliance. Only failures reach a human. |
| 6 | `references.ts` | reasoning | Cross-topic duplicate detection (`same_as`) and prerequisite extraction (`prerequisites`). |
| 7 | `store.ts` | — | Checkpointed, atomic, resumable writes. |

### Why it's shaped like this

- **Fan-out, not a for-loop.** The only real dependency is parent → child; siblings are independent once the parent's text exists. Level-parallel fill is the same call count at roughly a tenth of the wall-clock.
- **Verification is what makes human review survive scale.** "Light-touch solo review" works at 4 nodes per topic. At 65 × 20 it's the bottleneck, and it's the step that quietly stops happening. Flagging turns *review 65* into *review the 9 that failed*.
- **Contracts fix redundancy at the source.** Writing each node with only its parent's prose as context is why three nodes all re-derive backpropagation.
- **Resumable by default.** A re-run grafts what's already on disk onto the fresh tree and skips it. A rate-limit on node 64 costs you one node, not sixty-four.

### Flags

| Flag | Effect |
|---|---|
| `--rewrite` | Re-write nodes that already have text (default is resume) |
| `--skip-research` | Skip stage 0 |
| `--skip-verify` | Skip stage 5 — only sensible for a throwaway run |
| `--references` | Run the cross-topic pass instead of authoring |

### Reviewing flagged nodes

Verification writes onto each node:

```jsonc
"verification": {
  "checked_at": "2026-08-18T…",
  "passed": false,
  "issues": [{ "check": "facts", "severity": "blocker", "detail": "…" }]
},
"needs_review": true
```

Find everything awaiting review:

```bash
grep -l '"needs_review": true' content/topics/*.json
```

Clear a node by fixing the text and setting `needs_review` to `false`.

---

## Configuration

### Models

Three tiers, so planning and judging don't run on the cheap model and prose fill doesn't
run on the expensive one. If only `NVIDIA_API_KEY` is set, all three tiers resolve to
Nemotron and the chain behaves as it did before — routing is an optimisation, not a
prerequisite for a first run.

| Variable | Default |
|---|---|
| `KBFORGE_LLM_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `KBFORGE_LLM_API_KEY` | falls back to `NVIDIA_API_KEY` |
| `KBFORGE_MODEL_REASONING` | falls back to `_STANDARD` |
| `KBFORGE_MODEL_STANDARD` | falls back to `_FAST` |
| `KBFORGE_MODEL_FAST` | `nvidia/nemotron-4-340b-instruct` |

Any OpenAI-compatible chat-completions endpoint works — NVIDIA, OpenAI, OpenRouter,
Together, Groq. Requests retry with exponential backoff and honour `Retry-After`.

### Other

| Variable | Purpose |
|---|---|
| `TAVILY_API_KEY` or `BRAVE_API_KEY` | Search backend for stage 0. Without one, the chain runs **ungrounded** and says so. |
| `KBFORGE_CONCURRENCY` | Fan-out width (default 6) |
| `KBFORGE_CONTENT_DIR` | Write somewhere other than `content/` — used by the smoke test |

## Credentials (video stages — PRD §6 M1/M2)

- `NVIDIA_API_KEY` — content generation (or the `KBFORGE_LLM_*` equivalents).
- `HEYGEN_API_KEY` — avatar render.
- `YOUTUBE_*` — YouTube Data API OAuth credentials.
- `META_*` — Instagram/Meta Graph API credentials.

Until these exist, `upload/` and `avatar/` stages are stubbed (see each module's `index.ts`).
