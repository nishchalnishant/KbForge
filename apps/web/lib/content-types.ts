import type { Node } from "@kbforge/content-types";

/**
 * The deep-dive half of a node, fetched separately from the page.
 *
 * Declared here rather than in lib/content.ts so client components can import
 * the type without dragging the fs-based loader into the browser bundle.
 */
export type DeepPayload = Pick<Node, "deep_text" | "interview">;
