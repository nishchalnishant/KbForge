import type { Node, NodeLevel } from "@kbforge/content-types";
import { NemotronProvider, type ContentProvider } from "./provider.ts";

function promptForNode(title: string, level: NodeLevel, parentContext: string): string {
  const scope =
    level === "unit"
      ? "This is a leaf concept with no children — explain it atomically and concretely, including at least one worked example."
      : "This node has children — write an overview of what it splits into, not the full depth of each child.";

  return [
    `Write educational text for a "${level}" node titled "${title}" in a technical skill tree.`,
    parentContext ? `Parent context: ${parentContext}` : "",
    scope,
    "Write 3-6 sentences, plain prose, no headings or bullet points.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateNode(
  id: string,
  title: string,
  level: NodeLevel,
  parentContext: string,
  children: Node[] = [],
  provider: ContentProvider = new NemotronProvider(),
): Promise<Node> {
  const text = await provider.generateNodeContent(promptForNode(title, level, parentContext));
  return {
    id,
    level,
    title,
    text: text.trim(),
    status: "text_only",
    children,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error(
    "generate/index.ts exports generateNode() for use by a topic-authoring script; " +
      "it has no standalone CLI entry point yet.",
  );
  process.exit(1);
}
