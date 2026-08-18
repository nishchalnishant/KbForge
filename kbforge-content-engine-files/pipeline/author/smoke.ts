import { rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * End-to-end smoke test with a scripted provider — no credentials, no network.
 *
 * Exists because every stage in this chain is a prompt whose output is parsed
 * into a typed shape, and typecheck can't tell you the plumbing between them
 * actually fits. Run it before a real run to catch wiring breaks for free.
 *
 *   pnpm --filter @kbforge/pipeline smoke
 */
const workDir = mkdtempSync(join(tmpdir(), "kbforge-smoke-"));
process.env.KBFORGE_CONTENT_DIR = workDir;
process.env.KBFORGE_CONCURRENCY = "4";

const { authorPathway } = await import("./index.ts");
const { uniformProviders } = await import("../generate/provider.ts");
const { loadTopic } = await import("./store.ts");
const { levels } = await import("./structure.ts");

let calls = 0;

/** Answers each stage by recognising its prompt, so the shapes stay honest. */
const scripted = {
  async generateNodeContent(prompt: string): Promise<string> {
    calls++;

    if (prompt.includes("grounding brief") && prompt.includes("Describe how the subject")) {
      return "Conventionally taught from fundamentals upward, with agreement on the core three areas.";
    }
    if (prompt.includes("defining the scope")) {
      return JSON.stringify({
        title: "Smoke Topic",
        audience: "engineers new to the subject",
        summary: "A short pathway used only to exercise the authoring chain.",
        boundaries: ["no history", "no vendor specifics"],
      });
    }
    if (prompt.includes("evaluating") && prompt.includes("competing outlines")) {
      return JSON.stringify({
        scores: [
          { candidate: 0, score: 8, reason: "solid" },
          { candidate: 1, score: 6, reason: "gaps" },
          { candidate: 2, score: 7, reason: "ok" },
        ],
        best: 0,
        salvage: ["Alpha Two / Deeper"],
      });
    }
    if (prompt.includes("FINAL outline") || prompt.includes("Produce an outline")) {
      return JSON.stringify({
        sections: [
          {
            title: "Alpha",
            subsections: [
              { title: "Alpha One", units: [{ title: "Atom A" }, { title: "Atom B" }] },
              { title: "Alpha Two", units: [{ title: "Atom C" }] },
            ],
          },
          {
            title: "Beta",
            subsections: [{ title: "Beta One", units: [{ title: "Atom D" }] }],
          },
        ],
      });
    }
    if (prompt.includes("coverage contract")) {
      const titles = [...prompt.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]!);
      return JSON.stringify({
        assignments: titles.map((t) => ({
          title: t,
          must_cover: `the specifics of ${t}`,
          must_not_cover: titles.filter((o) => o !== t),
        })),
      });
    }
    if (prompt.includes("Write the content for a node")) {
      const isUnit = prompt.includes("Node level: unit");
      return JSON.stringify({
        text: "A short explanation that comfortably clears the minimum length required by the validator.",
        deep_text:
          "A longer explanation which also clears its own minimum length requirement, with enough " +
          "substance to look like real prose rather than a placeholder string of nonsense words.",
        ...(isUnit
          ? { interview: [{ question: "What is it?", answer: "It is the thing described above." }] }
          : {}),
      });
    }
    if (prompt.includes("fact-checking") || prompt.includes("repeats material") || prompt.includes("coverage contract it was written to")) {
      // One deliberate blocker so the review path is exercised too.
      const flag = prompt.includes("Atom B") && prompt.includes("fact-checking");
      return JSON.stringify({
        issues: flag ? [{ severity: "blocker", detail: "invented a statistic" }] : [],
      });
    }

    return JSON.stringify({ issues: [] });
  },
};

try {
  const result = await authorPathway("Smoke Topic", {
    providers: uniformProviders(scripted),
    log: (m) => console.log(`  ${m}`),
  });

  const reloaded = loadTopic(result.slug);
  if (!reloaded) throw new Error("topic was not persisted to disk");

  const nodes = levels(reloaded.root).flat();
  const missingText = nodes.filter((n) => !n.text.trim());
  const missingDeep = nodes.filter((n) => !n.deep_text?.trim());
  const units = nodes.filter((n) => n.level === "unit");
  const withInterview = units.filter((n) => n.interview?.length);
  const withContract = nodes.filter((n) => n.contract);
  const verified = nodes.filter((n) => n.verification);
  const flagged = nodes.filter((n) => n.needs_review);

  const problems: string[] = [];
  if (missingText.length) problems.push(`${missingText.length} node(s) missing text`);
  if (missingDeep.length) problems.push(`${missingDeep.length} node(s) missing deep_text`);
  if (withInterview.length !== units.length) problems.push("not every unit got interview questions");
  if (withContract.length !== nodes.length - 1) problems.push("contracts missing on non-root nodes");
  if (verified.length !== nodes.length) problems.push("not every node was verified");
  if (flagged.length !== 1) problems.push(`expected exactly 1 flagged node, got ${flagged.length}`);
  if (!reloaded.meta?.title) problems.push("topic meta was not written");

  console.log("");
  console.log(`nodes:        ${nodes.length} (${units.length} units)`);
  console.log(`deep_text:    ${nodes.length - missingDeep.length}/${nodes.length}`);
  console.log(`contracts:    ${withContract.length}/${nodes.length - 1} non-root`);
  console.log(`verified:     ${verified.length}/${nodes.length}`);
  console.log(`needs review: ${flagged.length}`);
  console.log(`llm calls:    ${calls}`);

  if (problems.length) {
    console.error("\nSMOKE FAILED:\n- " + problems.join("\n- "));
    process.exit(1);
  }
  console.log("\nSMOKE PASSED");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
