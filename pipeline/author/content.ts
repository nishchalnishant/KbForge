import type { Node } from "@kbforge/content-types";
import type { ContentProvider } from "../generate/provider.ts";
import { NemotronProvider } from "../generate/provider.ts";
import { generateNode } from "../generate/index.ts";

/**
 * Walks a structured (text-less) Node tree depth-first and fills in each
 * node's text via the existing generate/ stage, top-down so each node's
 * parent text is available as context for its children.
 */
export async function fillContent(
  node: Node,
  provider: ContentProvider = new NemotronProvider(),
  parentContext = "",
): Promise<Node> {
  const filled = await generateNode(node.id, node.title, node.level, parentContext, [], provider);

  const children: Node[] = [];
  for (const child of node.children) {
    children.push(await fillContent(child, provider, filled.text));
  }

  return { ...filled, children };
}
