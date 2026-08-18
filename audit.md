# learnforge.fyi — site review

**Reviewed:** 18 Aug 2026 · desktop Chrome · homepage, `/node/frontend`, `/node/html-css`, 404 route
**Repo:** github.com/nishchalnishant/KbForge · Next.js (App Router) on Vercel

---

## Verdict

The foundation is genuinely good. The writing is the strongest asset — the explainers are accurate, well-scoped, and free of the padding most "learn X" sites drown in. The design is confident and coherent, and the site is *fast* (473 ms full load, 7 requests, no images or web fonts on the wire).

What's holding it back isn't taste or engineering quality. It's that **nothing on the site is set up to be found, shared, or navigated past the first page.** No sitemap, no link previews, no search, no next-step links, and analytics that silently isn't running. Plus three controls that are visibly broken.

Roughly: strong content, strong craft, zero distribution surface.

---

## Broken right now

These are defects, not opinions. Each was reproduced.

### 1. Vercel Web Analytics is installed but not enabled — you have zero data
Console on every page:

> `[Vercel Web Analytics] Failed to load script from /f0f1d3a5e77e8003/script.js. Be sure to enable Web Analytics for your project and deploy again.`

The `@vercel/analytics` component is in your layout, but the feature isn't switched on for the project. You've been shipping blind.
**Fix:** Vercel dashboard → project → Analytics tab → Enable. No code change. *2 minutes.*

### 2. The "Tree map" tab does nothing
On every node page there's a `List | Tree map` toggle. Clicking "Tree map" — by mouse and programmatically — leaves `aria-selected="true"` on List and does not change the panel. Reproduced on `/node/frontend` and `/node/html-css`.

Either wire it up or hide it. A visibly dead control on the second thing a visitor touches costs more trust than the feature would earn.

### 3. "Go deeper →" on the first section links to the page you're already on
On `/node/frontend`, section `01/04` is *Frontend* itself, and its "Go deeper →" points to `/node/frontend`. Same on `/node/html-css`. Clicking it reloads the current page — a dead end disguised as a call to action.

**Fix:** for the self-section, either drop the link or point it at the first child.

### 4. Two buttons, one destination
Each section renders both `Open path →` and `Go deeper →`, and they resolve to the *same* URL. Pick one label.

### 5. The 404 page is stock Next.js
`/node/does-not-exist-xyz` returns the unstyled default — black page, "404 This page could not be found", no header nav, no links out. Given the URL scheme is guessable (`/node/<slug>`), people will land here.
**Fix:** a `not-found.tsx` with your shell, a line of copy, and links to the topic index.

---

## Discovery — the biggest gap

You have 88 concepts across ~20+ indexable URLs and essentially nothing pointing search engines or social platforms at them.

| Missing | Consequence |
|---|---|
| **No Open Graph tags** (`ogCount: 0`) | Every share on X, LinkedIn, Slack, WhatsApp, Discord renders as a bare grey link. For a text-content site, this is the single highest-leverage miss. |
| **No Twitter card tags** | Same. |
| **No `robots.txt`** (404) | — |
| **No `sitemap.xml`** (404) | Google has to discover all 88 pages by crawling. Next.js generates this from your node list in ~15 lines. |
| **No canonical tags** | Combined with the next row, this is a real duplicate-content risk. |
| **`learnforge-fyi.vercel.app` also serves Production** | Google can index the preview domain alongside the real one and split ranking signals. Add a canonical to `https://www.learnforge.fyi/...` on every page, or `noindex` the vercel.app alias. |
| **No JSON-LD** | `Course` / `LearningResource` schema is a natural fit and can win rich results. |

Next.js App Router gives you almost all of this for free: `generateMetadata()` for OG/canonical, `app/sitemap.ts`, `app/robots.ts`, and `opengraph-image.tsx` (which can render a per-node OG image from the node title — no design work needed).

**Priority: do OG tags + sitemap + canonical first.** They're a couple of hours total and they're the difference between a site that can grow and one that can't.

---

## Navigation — readers hit walls

**Leaf pages are dead ends.** `/node/html-css` has exactly four links: the logo, GitHub, Home, and its parent *Frontend*. Someone who just finished HTML & CSS gets no link to *JavaScript* or *Frontend Frameworks* — the sibling concepts that are literally the next step in the same path.

Add to every node page:

- **Prev / Next within the path** — the highest-value single change for time-on-site
- **Sibling list** ("Other concepts in Frontend")
- **Related nodes across topics** — the "living skill tree" premise implies a graph; right now the navigation is a strict tree with no cross-links

**No search.** 20 topics, 88 concepts, and no way to jump to one. A `⌘K` palette over a static JSON index is maybe half a day and would fit the product's aesthetic exactly.

**Footer has no links.** It's one sentence: *"learnforge.fyi — text-first explainers, narrated video landing on every node soon."* That's prime real estate on a site with no other global navigation. Put the topic list there.

---

## Content density — the pages fight the pitch

Your homepage promises: *"a short, precise explanation you can read in under a minute."*

Measured on `/node/frontend`:

- **345 words**
- **3,521 px of page height**
- ≈ **10 words per 100 px of scroll**

Each section takes roughly one and a half viewports, most of it empty, with a decorative mock-window card on the right that carries no information — just a number and two coloured squares. The reader scrolls through a lot of nothing to reach four short paragraphs.

The cinematic layout is a legitimate aesthetic choice, but it's currently in direct tension with the "read in under a minute" promise. Options, in order of how much I'd recommend them:

1. **Tighten the section rhythm** — cut each section's vertical space by ~40%. Keeps the look, halves the scrolling.
2. **Give the decorative card a job** — put the concept's key takeaway, a code snippet, or a diagram in it. It's a third of the screen; right now it's a placeholder.
3. **Offer a dense mode** — a "compact view" toggle that stacks all sections as tight prose. (This is arguably what the dead Tree map tab was reaching for.)

---

## Homepage details

**Card descriptions clip mid-line.** Most cards truncate cleanly with `…`, but *Databases* and *DevOps* get sliced horizontally through the middle of a line of glyphs — the text is being clamped by container height rather than by line count. Inconsistent and it reads as a bug.
**Fix:** `-webkit-line-clamp: 3` (or `line-clamp`) on all cards uniformly.

**Twenty "0%" progress bars.** Every card shows a `0%` bar on first visit. It's twenty identical zeros of visual noise, and it advertises a progress feature before the visitor has any progress. Hide the bar until progress > 0.

**Each card is one giant `<a>`.** The accessible name of every topic link is the entire card text concatenated — *"Topic5 conceptsMachine LearningMachine learning splits into two broad families…"*. Screen readers announce the whole paragraph as link text, and it's meaningless anchor text for SEO.
**Fix:** link the heading, and use a `::after` pseudo-element stretched over the card for the clickable area.

---

## Accessibility & polish

| Item | Detail |
|---|---|
| **Duplicate `<h2>` per section** | Each section title appears twice in the heading outline (`Frontend`, `Frontend`, `HTML & CSS`, `HTML & CSS`…) — once in the text column, once in the decorative card. Make the decorative copy a `<div>` or `aria-hidden`. |
| **Page background is transparent** | `html` and `body` both compute to `rgba(0,0,0,0)`. The dark look comes from a `position: fixed` mesh layer. Result: white flash on macOS/iOS overscroll bounce, and light-mode scrollbars on a black page. |
| **No `color-scheme: dark`** | Add it, plus `<meta name="theme-color" content="#0a0a0a">` so mobile browser chrome matches. |
| **Inter is declared but never loaded** | Font stack is `Inter, -apple-system, system-ui, "Segoe UI", sans-serif`, and no font file is requested. Anyone without Inter installed sees a fallback. Either self-host it via `next/font` (keeps your zero-network-font speed) or drop Inter from the stack so the design is tuned to what people actually see. |
| **Tap targets** | Smallest interactive elements measure 27 px and 39 px; guideline is 44 px. |
| **Muted text contrast** | `rgb(115,123,112)` on near-black = **4.52:1** at 12 px. Passes WCAG AA by 0.02. Bump it to ~5.5:1 for headroom. |
| **`prefers-reduced-motion` respected** | ✅ Nice — you already handle this. |

**Brand nit:** your only outbound link goes to a repo called **KbForge** while the product is **learnforge**. Rename the repo or add a line explaining the relationship.

---

## Strategy

You promise narrated video on every node — *twice* on the homepage, and again as a "Video coming soon" badge on **every single section** of every node page. That's a lot of repetition of something that doesn't exist yet.

Two thoughts:

1. **Show the badge once per page**, not once per section. Repeated unfulfilled promises read as vapourware.
2. **Capture the interest.** Right now someone who's excited about the video has no way to hear when it lands — no email field, no RSS, no "notify me". You're generating anticipation and then dropping it on the floor. One email input in the footer, or an RSS feed, would cost an hour.

---

## Recommended order

**This week — high impact, low effort**

1. Enable Vercel Web Analytics *(2 min)*
2. Add Open Graph + Twitter tags with a generated per-node OG image *(2–3 h)*
3. Add `sitemap.ts`, `robots.ts`, canonical tags; `noindex` the `.vercel.app` alias *(1–2 h)*
4. Fix or hide the Tree map tab *(30 min–?)*
5. Remove the self-referential "Go deeper" link and the duplicate CTA *(20 min)*
6. Custom 404 with navigation *(30 min)*
7. `html { background:#0a0a0a; color-scheme:dark }` + `theme-color` meta *(5 min)*

**Next — engagement**

8. Prev/Next + sibling links on every node *(half day)* ← biggest lever for retention
9. Uniform `line-clamp` on homepage cards; hide 0% progress bars *(1 h)*
10. Footer topic navigation *(1 h)*
11. Fix duplicate H2s and card link semantics *(1–2 h)*

**Then — growth**

12. `⌘K` search over a static index *(half day)*
13. Tighten node-page vertical rhythm, or give the decorative card real content *(1 day)*
14. Email capture / RSS for the video launch *(1 h)*
15. Deepen the top ~10 concepts to 800+ words for SEO competitiveness *(ongoing)*

---

## What's already working — don't break it

- **Speed.** TTFB 34 ms, DOMContentLoaded 339 ms, full load 473 ms, 7 requests, no images, no web fonts over the network. Most educational sites are 10× this.
- **The writing.** Accurate, appropriately scoped, no filler. This is the moat.
- **Zero friction.** No account, no cookie banner, no ads, no modal. The "0 accounts needed" stat is a real differentiator — lead with it harder.
- **Clean URLs.** `/node/<slug>` with a page per concept is exactly right for search.
- **Responsive foundation.** Breakpoints at 960 px and 640 px, no horizontal overflow, reduced-motion handled.
- **Visual identity.** The dark palette, gradient headline, and card system are coherent and read as designed rather than templated.
