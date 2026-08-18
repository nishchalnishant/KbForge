import type { Node, NodeLevel } from "@kbforge/content-types";
import { slugify } from "./slugify.ts";
import type { Outline } from "./outline.ts";
import type { Scope } from "./scope.ts";

/**
 * Deterministically turns the outline into the final Node tree shape
 * (ids, levels, empty text placeholders). No LLM call — pure structuring.
 * Text is filled in afterward by the content stage.
 *
 * Ids are deduplicated across the whole topic: "Overview" appearing under two
 * different sections would otherwise mint the same id twice, and `getNode`
 * resolves by id alone, so the second node would be unreachable.
 */
export function structureTopic(scope: Scope, outline: Outline): Node {
  const topicId = slugify(scope.title);
  const used = new Set<string>([topicId]);

  const mint = (parentId: string, title: string): string => {
    const base = `${parentId}-${slugify(title)}`;
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`;
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
  };

  return {
    id: topicId,
    level: "topic" as NodeLevel,
    title: scope.title,
    text: "",
    status: "text_only",
    children: outline.sections.map((section) => {
      const sectionId = mint(topicId, section.title);
      return {
        id: sectionId,
        level: "section" as NodeLevel,
        title: section.title,
        text: "",
        status: "text_only",
        children: section.subsections.map((subsection) => {
          const subsectionId = mint(sectionId, subsection.title);
          return {
            id: subsectionId,
            level: "subsection" as NodeLevel,
            title: subsection.title,
            text: "",
            status: "text_only",
            children: subsection.units.map((unit) => ({
              id: mint(subsectionId, unit.title),
              level: "unit" as NodeLevel,
              title: unit.title,
              text: "",
              status: "text_only",
              children: [],
            })),
          } satisfies Node;
        }),
      } satisfies Node;
    }),
  };
}

/** Depth-first walk, parents before children. */
export function walk(node: Node, visit: (node: Node, parent: Node | null) => void, parent: Node | null = null): void {
  visit(node, parent);
  for (const child of node.children) walk(child, visit, node);
}

/** Every node in the tree, grouped by depth. Index 0 is the root. */
export function levels(root: Node): Node[][] {
  const out: Node[][] = [];
  let current = [root];
  while (current.length) {
    out.push(current);
    current = current.flatMap((n) => n.children);
  }
  return out;
}

export function countNodes(root: Node): number {
  let n = 0;
  walk(root, () => n++);
  return n;
}
