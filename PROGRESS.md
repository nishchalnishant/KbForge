# Progress

Pivoted away from the original multi-tenant SaaS build (deleted: `apps/api`, old
`apps/web`, `packages/agent`, `packages/content`, `packages/engine`, `db/`). Current
direction per PRD.md: a git-content-backed skill-tree site with an automated
video-generation + YouTube/Instagram publishing pipeline.

## Done

- `packages/content-types` — shared `Node`/`Topic`/`Roadmap` types, consumed by
  `apps/web` and `pipeline/` via `workspace:*`.
- `content/topics/machine-learning.json` — pilot topic, 5 nodes across topic → section →
  subsection → unit → unit depths, all `status: "text_only"`.
- `apps/web` (Next.js 15, App Router) — home page lists topics, `/node/[nodeId]` renders
  any node (topic/section/subsection/unit) with its children as scroll-snap cards.
  Verified: dev server serves all 5 pilot nodes, navigation between depths works,
  typecheck clean.
- `pipeline/author/` — scope agent → outline agent → structure (planning) agent →
  content-fill agent chain. Takes a bare pathway name (e.g. "Frontend Development") and
  produces a full `content/topics/<slug>.json` `Topic` tree, reusing `generate/`'s
  `NemotronProvider`/`generateNode` as the content-fill step's LLM call. Fully
  implemented, no credential needed to build it, only to call it.
- `pipeline/generate/` — `ContentProvider` interface + `NemotronProvider` (NVIDIA
  build.nvidia.com), fully implemented (not stubbed — no credential needed to build it,
  only to call it).
- `pipeline/capture/` — Playwright screen recording of a live node page, scroll-synced
  to narration duration. Fully implemented, no credentials required.
- `pipeline/avatar/` — HeyGen render client + local ffmpeg PIP compositing
  (circle-mask overlay, since no avatar provider reliably supports alpha output).
  Throws a clear error until `HEYGEN_API_KEY`/`HEYGEN_AVATAR_ID`/`HEYGEN_VOICE_ID` exist.
- `pipeline/upload/` — YouTube Data API resumable upload client (stubbed until
  `YOUTUBE_ACCESS_TOKEN` exists); Instagram/Meta Graph API cross-post client
  (intentionally deferred to M2 per PRD §6 regardless of credentials).
- `pipeline/backfill/` — writes `youtube_video_id` + `status: "published"` back onto
  the Node JSON in `content/topics/*.json`.
- `pipeline/run.ts` — per-node orchestrator: capture → avatar → upload → backfill.
- Workspace: `pnpm-workspace.yaml` includes `apps/*`, `packages/*`, `pipeline`;
  `pnpm install` and `typecheck` pass clean across all 4 packages (author/ included).

## Not done / blocked on credentials

- No HeyGen account/API key — avatar stage cannot actually render.
- No YouTube Data API OAuth app — upload stage cannot actually upload.
- No Meta Graph API credentials — Instagram cross-post cannot run (deferred to M2
  regardless).
- `NVIDIA_API_KEY` not set — generate stage cannot actually call Nemotron yet.
- No end-to-end pipeline run has happened; nothing has been published.

## Open question

Navigation model: currently `/node/[nodeId]` is directly deep-linkable with no
enforcement of a top-down parent-before-child path. Never explicitly confirmed with the
user whether that's intended vs. requiring strict top-down traversal.
