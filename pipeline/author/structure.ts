import type { Node, NodeLevel } from "@kbforge/content-types";
import { slugify } from "./slugify.ts";
import type { Outline } from "./outline.ts";
import type { Scope } from "./scope.ts";

/**
 * Deterministically turns the outline into the final Node tree shape
 * (ids, levels, empty text placeholders). No LLM call — pure structuring,
 * per the user's "planning agent structures the content" step. Text is
 * filled in afterward by the content-writing stage.
 */
export function structureTopic(scope: Scope, outline: Outline): Node {
  const topicId = slugify(scope.title);

  const root: Node = {
    id: topicId,
    level: "topic" as NodeLevel,
    title: scope.title,
    text: "",
    status: "text_only",
    children: outline.sections.map((section) => {
      const sectionId = `${topicId}-${slugify(section.title)}`;
      const sectionNode: Node = {
        id: sectionId,
        level: "section" as NodeLevel,
        title: section.title,
        text: "",
        status: "text_only",
        children: section.subsections.map((subsection) => {
          const subsectionId = `${sectionId}-${slugify(subsection.title)}`;
          const subsectionNode: Node = {
            id: subsectionId,
            level: "subsection" as NodeLevel,
            title: subsection.title,
            text: "",
            status: "text_only",
            children: subsection.units.map((unit) => ({
              id: `${subsectionId}-${slugify(unit.title)}`,
              level: "unit" as NodeLevel,
              title: unit.title,
              text: "",
              status: "text_only",
              children: [],
            })),
          };
          return subsectionNode;
        }),
      };
      return sectionNode;
    }),
  };

  return root;
}
