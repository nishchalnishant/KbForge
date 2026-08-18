# Authoring spec

Every node gets `text` and `deep_text`. Leaf nodes also get `interview`.

## text — the short read (the 30–45 second version)

- 3–5 sentences, **80–120 words**. This is read aloud in a reel; it must sound
  like speech, not like a textbook caption.
- Must stand alone. A reader who landed here from search, with no parent
  context, understands it.
- Open with the idea itself, not with throat-clearing. Never begin with
  "In machine learning," / "This section covers" / "Let's explore".
- For **leaf nodes**: explain the concept concretely.
- For **nodes with children**: orient the reader in what this splits into and
  *why* it splits that way. Do **not** explain the children's material.

## deep_text — the long read

- **350–500 words** for leaves, **250–350** for nodes with children.
- Leaves must include, woven into prose (not as headings):
  1. one **concrete worked example** with real numbers or a real scenario,
  2. one **common misconception** stated and then corrected,
  3. when it matters, the **decision rule** — when to reach for this and when not to.
- Nodes with children: how the children relate, and in what order they make
  sense. No worked examples — those belong to the leaves.

## interview — leaf nodes only

Exactly 3 questions, each with a **2–4 sentence** answer. These are questions
as actually asked in technical interviews and design reviews — not quiz
prompts. Prefer "why" and "when would you" over "define".

## Contracts

Each node carries `must_not_cover`: titles owned by its siblings. You may
*reference* that material in one clause ("unlike ridge, which…") but must not
explain it. This is the single biggest source of redundancy — three nodes each
re-deriving gradient descent — and the contract is how it gets prevented.

## Voice

- Plain, direct, technically precise. Respect the reader's intelligence.
- **No markdown inside strings.** No headings, bullets, bold, or code fences.
  Inline code identifiers are fine as plain words.
- Prefer the concrete over the abstract. "A model that memorises the training
  set scores 100% there and 60% on held-out data" beats "overfitting degrades
  generalisation performance".
- British or American spelling — match the node title you were given.
- Never invent citations, papers, dates, or benchmark numbers. If a specific
  figure would be needed, describe the shape of the result instead.

## Audience

Working engineers and strong CS students who can code but have not formally
studied ML. Comfortable with Python and basic linear algebra. Not assumed to
know optimisation calculus, probability theory, or any ML framework.

## Scope boundaries for this topic

Do not drift into: deep learning architectures beyond the perceptron and basic
backprop; LLMs, transformers, prompting, generative AI; RAG or agent
engineering; data warehouse construction. Those are other pathways. Reference
them by name if useful, but do not teach them.

## Output

Write exactly one JSON file, `pipeline/author/batches/<topic>/<job-key>.json`:

```json
{
  "node-id": {
    "text": "...",
    "deep_text": "...",
    "interview": [{ "question": "...", "answer": "..." }]
  }
}
```

Keys are node ids from your job input, and every id in your input must appear
exactly once. `interview` only on nodes whose `children` array is empty.
Strict JSON — no trailing commas, no comments, no markdown fence around it.
