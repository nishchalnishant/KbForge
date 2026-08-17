# kbforge — Product Requirements

**Status:** pre-build. This is the founding spec.
**Audience:** Claude Code, working in this repo.
**Relationship to kbtutor:** kbforge is a new, separate project. It reuses kbtutor's
core teaching loop (lesson generation, blind grading, FSRS scheduling) as a *library of
ideas*, not as a dependency — kbtutor is explicitly single-user, local-only, and
non-multi-tenant on purpose, and those invariants don't hold here. Do not try to bolt
multi-tenancy onto kbtutor; build this as its own service.

---

## 1. The problem

kbtutor proved the teaching loop works for one person and their own markdown repos:
generate a lesson from source content, test with graded items, schedule the next review
with FSRS. But it assumes you already have good notes, and it assumes you're the only
user.

Most people don't have five hand-written knowledge repos. They want to learn "frontend"
or "backend" or "system design" without first authoring the content themselves — but
generic AI tutoring (ask a chatbot anything) has no persistent curriculum, no tracked
mastery, and no shared, improvable source of truth.

## 2. What this product does

A hosted, multi-user platform where:

1. A visitor sees a catalog of public knowledge bases (KBs) — e.g. "Frontend", "System
   Design", "Backend" — each structured the way kbtutor expects (topics, sections,
   prereqs).
2. They pick one and start studying immediately: generated lessons, graded practice
   items (MCQ, fill-in-blank, freeform, code), FSRS-scheduled reviews — the kbtutor loop,
   now behind a login instead of a local CLI.
3. If the stock KB doesn't fit — too broad, wrong framework, missing depth — they fork
   it. Forking gives them a private, editable copy, versioned against the original.
4. They evolve their fork by talking to an agent ("make this React-specific," "add a
   section on server components," "drop the Angular material") rather than hand-editing
   markdown. The agent proposes content diffs against the fork.
5. They can merge changes back upstream (propose a PR against the public KB), keep
   iterating privately, or publish their fork as its own public KB for others to start
   from.
6. If no KB exists for a topic at all, they ask an agent to draft one from scratch, into
   a private KB, then choose to make it public once it's good enough to teach from.
7. A web UI shows their learning paths across every KB they've started, progress,
   mastery, and gaps — the kbtutor progress view, generalized across many KBs and one
   account instead of one filesystem.
8. Usage beyond a free tier is metered by subscription: how many active learning paths,
   how much agent-authoring activity, how many assessments.

## 3. Non-goals

- **Not local-only.** This is a hosted, multi-tenant service by design — the inverse of
  kbtutor's invariant.
- **Not open-source-only.** The plan is source-available at most; the product is the
  hosted service and the subscription, not a self-hostable artifact (revisit only if the
  business model changes).
- **Not a general document platform.** KBs are still markdown, still topic-per-section,
  still governed by a content contract like kbtutor's `CONTENT_GUIDE.md` — this is not
  Notion or a wiki.
- **Not unlimited free agent usage.** Agent-assisted authoring costs real LLM spend per
  call; free tier must be bounded from day one, not bolted on later.
- **Not real-time collaborative editing.** Forks are async (fork → edit → merge/PR), not
  Google-Docs-style concurrent editing. Revisit only if users ask.

## 4. Invariants

Carried over from kbtutor where they still apply, plus new ones for multi-tenancy.

1. **Every user's graded history is theirs alone and append-only.** `attempts` per user
   is never edited or deleted, exactly as in kbtutor — this is non-negotiable, it's the
   product's memory.
2. **Answer keys never reach the browser**, for any user, for any KB, public or private.
   Same strip-list discipline as kbtutor's `_strip()`.
3. **The grader marks blind** — no user's past scores, streak, or subscription tier may
   influence grading.
4. **A KB's content is versioned, not mutated in place.** Forking, editing, and merging
   must be diffable and revertible — content is data with history, not a live document
   silently rewritten under a learner mid-course.
5. **Public KBs are reviewable before they affect other users.** Publishing a fork or a
   fresh AI-drafted KB is a distinct, explicit action from saving it privately. No content
   reaches the public catalog by default.
6. **Tenant isolation is absolute.** One user's private KB, attempts, or agent
   conversation must never be readable by another user or leak through a shared cache,
   log, or LLM prompt.
7. **Agent-authored content is proposed, not applied, until a human accepts it.** Mirrors
   kbtutor's "no auto-generated prereq edges without human review" — the agent drafts a
   diff; the user (or a maintainer, for merges into a public KB) approves it.
8. **Billing and access control never touch the grading or scheduling path.** Same
   separation of concerns as kbtutor's "LLM never owns state" — a subscription check gates
   *access*, never grading correctness or FSRS math.

## 5. Core concepts

- **Knowledge base (KB):** the kbtutor "track," generalized — a versioned collection of
  topics with prereqs, style config, and item-mix config. Has an owner, a visibility
  (`public` / `private`), and a lineage (nothing / forked-from-X).
- **Fork:** a private copy of a KB, owned by a user, with a recorded parent. Diffable
  against the parent at any time.
- **Merge / PR:** a proposed set of content changes from a fork back into its parent
  (or another KB the user has write access to). Reviewed before applying — by the parent
  KB's owner if it's someone else's public KB, or applied directly if it's the user's own.
- **Learning path:** one user's enrollment in one KB (fork or original) — their
  `review_state`, `attempts`, and `gaps`, scoped to `(user, kb)`.
- **Agent-authoring session:** a conversation where a user directs an agent to draft or
  modify KB content. Produces a content diff for review, never writes directly to a
  published KB.

## 6. Current architecture (target, not yet built)

```
apps/api/          hosted API: auth, KBs, forks/merges, learning paths, billing webhooks
apps/web/           the UI: catalog, KB view, study session, agent-authoring chat, progress
packages/engine/    the kbtutor teaching loop, generalized to (user_id, kb_id) — lesson
                     generation, blind grading, FSRS scheduling, gap tracking
packages/content/   KB storage and versioning — diff, fork, merge, content-contract checks
packages/agent/     the authoring agent: turns chat instructions into a reviewable KB diff
db/                 multi-tenant schema: users, kbs, kb_versions, forks, learning_paths,
                     review_state, attempts (per user+kb), gaps, subscriptions
```

**Stack decisions to make before P0** (see §9 — flag these to the user, don't assume):
- Postgres (not SQLite) for multi-tenant storage, given concurrent writers and the need
  for row-level tenant isolation.
- KB content versioning: real git repos per KB (one repo, branches = forks) vs. a
  DB-modeled version table. Git gives free diff/merge tooling; DB-modeled is simpler to
  query and gate visibility on. This is a foundational decision — resolve it first.
- Auth provider (build vs. buy — e.g. Clerk/Auth0 vs. rolling it) and billing provider
  (Stripe is the default assumption for subscriptions).

## 7. Work items

Ordered. Each phase should be independently demoable — don't skip ahead.

### P0 — Foundational decisions + multi-tenant skeleton
- Resolve the git-vs-DB content versioning question (§6) before writing any storage code.
- Auth (signup/login), tenant-scoped Postgres schema, empty catalog page.
- Port the kbtutor engine (`kb/fsrs.py`, `kb/llm.py`, `kb/select.py` equivalents) to be
  parameterized by `(user_id, kb_id)` instead of a single local DB.
- **Done when:** a seeded public KB can be studied end-to-end by a logged-in user —
  lesson, graded item, FSRS reschedule — with zero cross-tenant data paths.

### P1 — Fork, edit-by-agent, merge
- Fork a public KB into a private copy.
- Agent-authoring chat that proposes a content diff against a fork (not a live edit).
- Accept/reject diff review UI.
- Merge (PR) a fork's accepted changes back to its parent, or publish the fork standalone.
- **Done when:** a user can fork "Frontend," ask an agent to make it React-only, review
  the diff, accept it, and either merge or publish independently.

### P2 — Public catalog + create-from-scratch
- Public catalog browsing, search, and KB detail pages showing lineage (forked from X).
- "No KB exists for this" flow: agent drafts a new KB from scratch into a private
  workspace, content-contract-checked (kbtutor's `CONTENT_GUIDE.md` rules), then an
  explicit publish action.
- **Done when:** a user can go from "there's no backend KB" to a published, publicly
  studyable backend KB without ever hand-writing markdown.

### P3 — Progress dashboard
- Cross-KB progress view per user: active learning paths, mastery, gaps, streoften
  (data only — no gamified streak mechanics, per kbtutor's rejected-ideas list).
- **Done when:** a user with 3+ learning paths can see, at a glance, what's overdue and
  where their gaps are, across all of them.

### P4 — Billing and metering
- Free tier limits (number of concurrent learning paths, agent-authoring calls/month).
- Subscription tiers + Stripe integration; usage metering wired to real limits, not just
  UI copy.
- **Done when:** a free user hitting a limit gets a clear upgrade prompt, and a paying
  user's limits are actually enforced server-side, not just hidden in the UI.

### P5 — Grader eval harness (port from kbtutor)
- Same shape as kbtutor's `eval-grader`: labeled cases, MAE, leniency %, stability check
  — but run per-KB, since grading rubrics vary with content and track style.
- **Done when:** leniency is measurable per KB, not just globally.

## 8. Explicitly rejected

- Self-serve full open-source release (revisit only if the business model changes)
- Real-time concurrent content editing
- Letting the agent write directly to a published, public KB
- Gamification: streaks, XP, badges — same rejection as kbtutor, same reasoning (the
  forgetting curve is the feedback signal, not a badge)
- A generic document/wiki editor — KBs stay markdown, topic-per-section, content-contract
  constrained

## 9. Open questions to resolve with the user before P0

- Git-backed vs. DB-modeled KB versioning (§6) — this changes almost everything else.
- Build-vs-buy for auth and billing.
- Pricing shape: per-seat, per-learning-path, per-agent-call, or flat tiers?
- How much of the kbtutor engine code is literally reusable (copy/adapt) vs. needs a
  rewrite for multi-tenancy — worth a spike before committing to the P0 timeline.

## 10. How success is measured

- **First month:** one public KB fully seeded, end-to-end study loop works for multiple
  concurrent accounts with verified tenant isolation.
- **Third month:** fork → agent-edit → merge loop used by real users at least once
  without maintainer intervention.
- **Sixth month:** enough paying subscriptions to judge whether the pricing model holds
  up against actual agent-authoring cost.
- **The failure mode to watch:** a fork/merge system nobody uses because studying the
  stock public KB was good enough — if forking usage stays near zero after real users
  arrive, that's a signal to simplify, not to add more editing features.
