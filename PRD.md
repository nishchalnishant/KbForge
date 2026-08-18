# kbforge — Product Requirements

**Status:** pre-build, rescoped. This replaces the multi-tenant SaaS spec below the line —
that version is fully superseded, not layered on top of.

**Pivot note (2026-08-18):** the original PRD described a hosted, multi-tenant learning
platform (accounts, forking KBs, FSRS-scheduled study, billing). That direction is
**abandoned**, not deferred — no code existed against it (repo had skeleton
`package.json`/`tsconfig` only, no `src/`), so this is a clean rewrite, not a migration.
See §0 for why, and the old PRD's ambition (structured content beats raw chat) is the one
idea carried forward — everything about *how* it's delivered has changed.

---

## 0. Why the pivot

The multi-tenant model required solving auth, billing, per-user forking/merge, and
tenant-isolated grading before a single real user could be acquired — a large build with
no distribution channel behind it. The new model inverts that: build the audience first
(YouTube/Instagram Shorts, algorithm-driven, zero acquisition cost) and let a much
simpler website absorb the traffic that already exists, rather than trying to be the
traffic source itself.

**Core insight:** an AI-narrated (face-on-camera, not generic AI-slop) short-form video
explaining one atomic concept is itself the distribution mechanism. The website is not
where growth comes from — it's a durable, text-searchable archive of the same content,
for people who prefer reading or want the structured version after watching.

**Tutor framing (added 2026-08-18):** the video is not a separately-produced explainer —
it is a screen recording of the Unit's own webpage, scrolling in sync with narration,
with the avatar overlaid (picture-in-picture) reading and explaining exactly what's on
screen. The avatar never narrates from independent script content; it walks through the
same page a website visitor would read. This is deliberate: it makes the video feel like
someone sitting beside the viewer guiding them through the material — a tutor, not an ad
— and it structurally guarantees video and text never diverge, since one is a recording
of the other. It also collapses video production to a repeatable template (capture +
PIP + scroll-sync narration) instead of a bespoke scene per topic.

## 1. The product

A **content site**, not a platform. No accounts, no billing, no user-generated content,
no per-user state of any kind.

1. Content is organized as **skill trees** ("Frontend", "Backend", "Machine Learning",
   "LLM", "AI Engineering") and **roadmaps** ("AI Engineer roadmap") — see §3 for the
   distinction.
2. **Every node in the tree has its own text and its own video** — not just leaves. A
   Topic node ("Machine Learning") has an overview covering what it splits into
   (classical ML vs. deep learning); each Section ("Classical Machine Learning") has its
   own overview one level deeper (supervised vs. unsupervised); each Subsection
   ("Supervised Learning") the same again (regression vs. classification); down to the
   leaf **Unit** ("Linear Regression"), the atomic concept with no children. Same content
   shape recursively at every depth — a Unit is simply the base case where there's
   nothing left to preview. Navigation funnels top-down: clicking a node shows its
   overview + a preview of its children, clicking a child goes one level deeper.
3. Nodes are authored once (LLM-generated, human-reviewed once, not per-viewer) and can
   appear in more than one tree — e.g. a "Prompt Engineering" node is standalone in the
   LLM roadmap *and* appears inline inside the Machine Learning roadmap's LLM section. No
   redirect or "see it in the other roadmap" link between the two placements — the same
   content simply renders in both places.
4. On the website, a node shows its text by default, with a toggle to reveal the matching
   video inline if one exists. If no video exists yet, the toggle is absent (not shown as
   disabled) — the node is fully readable standalone.
5. A node's children render as a **vertical scroll** (one child per screen-height card, in
   sequence) — a doomscroll-native layout deliberately borrowed from Shorts/Reels UX,
   applied to a chain of "next concept" instead of an infinite unrelated feed.
6. Publishing is **progressive and asynchronous**, per node: a node's text can go live
   standalone (`status: text_only`); its video is produced afterward by a separate,
   locally-run pipeline and back-attached once it exists (`status: published`). The
   website never blocks on video availability, at any depth.
7. **The full pipeline is automated end to end** — content generation, video generation,
   upload, and cross-posting all run without manual per-node work (see §4). Human review
   is a deliberate gate on text before publish (§4 stage 1) and is the only manual step by
   design; every stage after approval is unattended.

## 2. Non-goals

- **No accounts, login, or per-user state.** No progress tracking, no FSRS, no grading,
  no personalization. If retention data later justifies it, revisit — not designed now.
- **No user-generated content.** All content is authored by the operator (via LLM +
  human review), not by visitors.
- **No video hosting.** All video lives on YouTube/Instagram; the site embeds/links to it,
  never re-hosts or transcodes it.
- **No monetization on the website.** No ads, no subscriptions, no paywall. Revenue is
  entirely off-platform (YouTube/Instagram ad revenue on the Shorts/Reels themselves).
  The site's job is durability and search surface area, not conversion or revenue capture.
- **No traffic-routing pressure from video to site.** A short may end with a soft "more on
  [site]" mention, but the funnel is not designed or measured as video→site conversion;
  Shorts/Reels algorithms suppress off-platform links, so treating click-through as a KPI
  would optimize for the wrong thing. See §7 metrics.
- **Not a general document platform / wiki.** Content stays constrained to the
  Topic → Section → Subsection → Unit node shape; no freeform pages.

## 3. Core concepts

- **Node:** the general content-bearing entity at every level of a tree — `level` is one
  of `topic | section | subsection | unit`. Every node, regardless of level, has its own
  text content, its own optional `youtube_video_id`, its own status (`text_only` |
  `published`), and `children: Node[]` (empty for a `unit`, the leaf/base case). No node
  has a single fixed parent — any node can be referenced by multiple trees (see
  Reference, below). A Topic node's text is the top-level overview ("Machine Learning
  splits into classical ML and deep learning"); a Section/Subsection node's text is the
  same kind of overview one level deeper; a Unit's text is the atomic explanation with
  nothing left to preview.
- **Topic (skill tree):** the root Node for one subject area (e.g. "Machine Learning",
  "LLM", "Frontend", "Backend", "AI Engineering"), with Section → Subsection → Unit nodes
  beneath it. Owns the authoritative structure for that subject.
- **Roadmap:** an ordered sequence of node references (references at any level — a whole
  Section, a Subsection, or a single Unit) representing a career-oriented path (e.g. "AI
  Engineer"). A roadmap does not own content — it composes references into existing
  Topics' nodes. A Topic can itself double as a roadmap (e.g. "Machine Learning" is both a
  skill tree and a valid roadmap to follow top-to-bottom).
- **Reference (many-to-many):** the mechanism that lets one node render inside more than
  one Topic/Roadmap. Implemented as a join, not a copy — editing a node's text or video
  updates every place it's referenced.

## 4. Content generation pipeline

Simpler than a curriculum-DAG system — linear, mostly one-way (text before video), no
per-user branching. Runs **fully automated end to end**; the only manual gate is the
human review in stage 1.

1. **Text generation.** For a given Topic, an LLM drafts the full node tree (Section →
   Subsection → Unit breakdown) and generates text content **for every node at every
   level** — the Topic's own overview, each Section's overview, each Subsection's
   overview, and each Unit's atomic explanation — not text for leaves only. Human review
   before publish (light touch — solo-operator review, not a multi-stage adversarial
   pipeline).
   - **LLM provider:** abstracted behind a single interface
     (`generateNodeContent(prompt) → text`) so the underlying model is swappable without
     touching pipeline logic. Initial choice: **NVIDIA Nemotron via the build.nvidia.com
     API** (generous free/cheap tier, good enough quality for structured technical
     explainer text, near-zero marginal cost at this volume). Swap later if quality or
     limits demand it — nothing downstream depends on which model produced the text.
2. **Video generation (local, decoupled, but website-dependent).** Runs on the operator's
   machine, once a node's page is already live on the website — the page is the recording
   source, so this stage cannot run ahead of §5's site being up for that node. Because
   every node now has video (not just Units), video volume is substantially higher than a
   leaves-only model — the pipeline must sustain a much larger per-topic clip count. Per
   published node:
   - screen-record the node's live webpage, scrolling in sync with narration timing
   - narration script derived from the node's on-page text (not independently written —
     the avatar reads/explains what's on screen, not a separate script)
   - avatar rendered picture-in-picture over the recording, using a consistent AI
     avatar/voice built from the operator's own face and voice, for recognizability and
     trust (not a generic AI-presenter template)
   - **Avatar provider: HeyGen.** Chosen over Synthesia (custom clone ~$1,000/yr,
     API enterprise-gated), D-ID (real API tier ~$299/mo, PIP/transparency unclear), and
     Colossyan (thin docs/pricing) — HeyGen has the most mature, fully-documented REST API
     (avatar creation, generation, status polling) and pay-as-you-go per-minute pricing
     (~$1-5/min depending on tier) with no subscription lock-in. None of the evaluated
     providers reliably support alpha/transparent API output for a clean PIP composite, so
     **PIP compositing is done locally**: HeyGen renders a plain rectangular avatar clip,
     which is then cropped/masked (circle or lower-third box) and composited over the
     screen recording with ffmpeg. Fallback candidate if HeyGen's pricing/limits don't
     hold up at scale: **Argil** (flat $29-99/mo unlimited 1080p, single 2-min clone
     video, webhook-based async API — cheaper at 20-50 videos/month but less mature docs).
   - output as one short-form video per node
3. **Publish + backfill.** Finished video is uploaded to YouTube (and cross-posted to
   Instagram) via automated API calls; its ID is written back onto the node record, which
   is what makes the website's video toggle appear. No separate "site publish" step for
   video — the toggle showing up *is* the publish action. YouTube Data API and
   Instagram/Meta Graph API credentials do not exist yet (§6 M1) — these calls are stubbed
   until they're set up, but the pipeline code path is built now, not deferred.

Pipeline speed is the actual bottleneck (avatar/lip-sync render time, scroll/narration
sync, and per-clip HeyGen cost gate how many nodes/week can go from `text_only` to
`published`) — more so now that every tree level needs a clip, not just leaves. Because
video capture depends on the live page, the website (§6 M0) must exist and render a given
node correctly *before* that node's video can be produced — site work is upstream of
video work per-node, even though the two tracks (new topics on the site vs. working
through the video backlog) run at independent overall paces.

## 5. Architecture (target, rewritten)

```
apps/web/           the site: topic/roadmap browsing, vertical-scroll node view,
                     text + optional video toggle, at every level (topic/section/
                     subsection/unit). Server-rendered, SEO-indexable, no auth.
content/             git-tracked structured content (JSON per Node) — Topics,
                     Roadmaps, and Nodes (topic/section/subsection/unit, each carrying
                     its own text + optional video) with their reference graph. Not a
                     database; content is small, text-only, and versioned via git like
                     the rest of the repo.
pipeline/            local-only automation pipeline, end to end:
                       generate/  LLM content generation (Nemotron via build.nvidia.com,
                                  behind a swappable provider interface) → writes Node
                                  JSON into content/
                       capture/   screen-record a node's live page, scroll-synced
                       avatar/    HeyGen API render (narration from on-page text) +
                                  local ffmpeg PIP compositing over the capture
                       upload/    YouTube Data API upload; Instagram/Meta Graph API
                                  cross-post (both stubbed until credentials exist)
                       backfill/  writes youtube_video_id back onto the Node JSON
                     Runs on the operator's machine, not deployed. capture/ depends on
                     apps/web already serving the target node.
```

**Removed entirely** (superseded, no longer applicable): `apps/api`, `packages/engine`,
`packages/agent`, `packages/content`'s versioning/diff system, and `db/` — none of the
prior multi-tenant Postgres schema (`users`, `kbs`, `forks`, `learning_paths`,
`attempts`, `subscriptions`, RLS policies) is needed. There is no per-user data to
isolate and no concurrent-writer, multi-tenant storage problem to solve. See §9 for the
cleanup list.

**Stack decisions:**
- **No database for content.** Content volume (a handful of technical topics, text-only
  Units) is small enough and read-only-to-visitors enough to live as git-tracked
  JSON/MDX, built statically. Revisit only if content volume or an editing UI genuinely
  requires a DB later.
- **Hosting:** `apps/web` on Vercel (static/ISR generation, edge CDN — matches the
  SEO-indexable, no-auth, mostly-static nature of the content).
- **No Postgres, no Railway, no Clerk/Auth0, no Stripe.** All were scoped for
  multi-tenancy and billing, neither of which exists in this product.
- **Video pipeline stays local**, not deployed — it's a personal content-production tool,
  not a service other people invoke.

## 6. Work items

### M0 — Content schema + site skeleton
- Define the Node/Topic/Roadmap JSON schema (§3) and reference graph — recursive, every
  level carries text + optional video.
- One topic (e.g. "Machine Learning" → "Classical Machine Learning" → "Supervised
  Learning" → "Regression" → "Linear Regression"), ~5 nodes at varying depths (topic,
  section, subsection, unit — not 5 leaves), text drafted via Nemotron and reviewed.
- `apps/web`: static topic page, vertical-scroll node view (children of the current
  node), text-only rendering at every level, live and reachable (no video toggle yet —
  no video exists to link).
- **Done when:** the 5 pilot nodes are readable on the live site, at their respective
  depths — this is the prerequisite for M1, since video capture records these pages.

### M1 — Video pipeline proof of concept
- Build the full local automation chain: capture (record the live node page,
  scroll-synced) → narration script from on-page text → HeyGen avatar render → local
  ffmpeg PIP composite → YouTube upload, end to end, for the 5 M0 nodes.
- Set up YouTube Data API credentials (OAuth app + channel) and a HeyGen account/API key.
  Instagram/Meta Graph API credentials also need setup but Instagram posting can stay
  stubbed through M1 — YouTube upload is the M1 bar, cross-post lands in M2.
- **Done when:** 5 real YouTube Shorts exist, one per pilot node (topic/section/
  subsection/unit, not just the leaf), each a screen-recording of the matching live page
  narrated by the consistent avatar, uploaded without manual per-video editing
  intervention.

### M2 — Video/text linkage + Instagram cross-post
- Wire `youtube_video_id` backfill from the pipeline into the content schema.
- Site: video toggle appears once a node has a video; embed, don't rehost.
- Set up Instagram/Meta Graph API credentials; wire automated cross-post of the same
  render to Instagram Reels.
- **Done when:** all 5 M0/M1 nodes show the toggle and play their matching Short inline,
  and each is also live as a Reel.

### M3 — Roadmap composition
- Implement the reference mechanism: a node (any level) usable inside more than one
  Topic/Roadmap without content duplication.
- Build one cross-referencing example (e.g. a "Prompt Engineering" node that's standalone
  in an LLM roadmap and also appears inside the ML roadmap's LLM section).
- **Done when:** editing that node's text once updates both renderings.

### M4 — Scale content + topics
- Expand beyond the pilot topic to the full initial set: Frontend, Backend, Machine
  Learning, LLM, AI Engineering — full recursive trees, not just leaves.
- Steady-state local pipeline cadence established (however many nodes/week the
  generate → capture → avatar → upload chain can sustain end to end, unattended).
- **Done when:** each of the 5 topics has a real (if partial) skill tree live on the
  site, with the pipeline running as an ongoing automated background process, not a
  one-off demo.

### M5 — SEO surface hardening
- Server-rendered, crawlable node/Topic pages at every depth; sitemap; structured data
  where relevant.
- **Done when:** organic search traffic to node pages is measurable (search console or
  equivalent), independent of YouTube/Instagram referral traffic.

## 7. How success is measured

Revenue lives off-platform; the metrics that matter are about the two channels
separately, not funnel conversion between them.

- **YouTube/Instagram:** views, watch-through rate, subscriber growth, and ad RPM per
  Short — the actual revenue driver.
- **Website:** organic search sessions landing on node pages, and read-through (did they
  read past the first screen of a scroll sequence) — a proxy for whether the archive is
  actually useful once someone arrives, not a conversion funnel from video.
- **Content-pipeline throughput:** nodes moved from `text_only` to `published` per week —
  the practical constraint on how much of the catalog (§6 M4) can exist at any time, now
  measured across all tree levels, not leaves only.
- **Explicitly not tracked as a success metric:** video→website click-through rate. Per
  §2, this isn't the funnel design and optimizing for it would distort content decisions
  away from what actually performs on YouTube/Instagram's own algorithms.

## 8. Explicitly rejected

- **Multi-tenant accounts, billing, forking, FSRS study loop** — the entire previous PRD's
  product surface. Not deferred; actively decided against for this direction.
- **User-generated content of any kind.**
- **Hosting video on the website.** YouTube/Instagram are free, algorithmically-distributed
  hosts; re-hosting buys nothing and adds real infra cost.
- **Website monetization (ads, subscriptions, paywall).** Site is a support asset for the
  video channels' credibility/reach, not an independent revenue line.
- **Cross-navigation prompts between a node's multiple placements** (e.g. "see this in the
  other roadmap too") — deliberate: each roadmap should read as complete and self-
  contained even where content is shared under the hood.

## 9. Cleanup — dead weight from the prior direction

No source code exists yet against the old PRD (skeleton `package.json`/`tsconfig` files
only), so this is a deletion, not a migration:

- `db/` — all five migrations (multi-tenant schema, RLS policies) — no longer applicable,
  no DB in the new architecture.
- `apps/api/` — was the hosted API (auth, billing webhooks, forks/merges) — no API surface
  needed for a static content site.
- `packages/engine/` — kbtutor's FSRS/grading loop — not used; no study/grading feature.
- `packages/agent/` — the fork-diff authoring agent — not used; content generation is a
  simpler one-shot pipeline (§4), not a reviewable-diff system.
- `packages/content/` — was KB versioning/diff/fork storage — replaced by a much smaller
  `content/` directory of git-tracked JSON/MDX (§5); the diff/fork/merge machinery it was
  built for doesn't exist in this product.
- `apps/web/` — kept, but its planned scope (catalog, study session, agent-authoring chat,
  progress dashboard) is replaced by §6's much smaller scope (topic pages, scroll view).
