import fs from "node:fs";
import path from "node:path";
import type { Node, Topic } from "@kbforge/content-types";

/**
 * Topics are read from disk at build time rather than statically imported.
 * With static imports every page pulled the whole corpus into its module graph;
 * at 100 topics that becomes the dominant build cost for no benefit, since any
 * one page needs at most one topic.
 */
const TOPICS_DIR = path.join(process.cwd(), "..", "..", "content", "topics");

/**
 * Curated display order for the home page and footer. Files not listed here are
 * appended alphabetically, so adding a topic never breaks the build — it just
 * lands at the end until someone places it.
 */
const TOPIC_ORDER = [
  "machine-learning.json",
  "frontend.json",
  "backend-engineering.json",
  "databases.json",
  "system-design.json",
  "devops.json",
  "cloud-computing.json",
  "data-structures-and-algorithms.json",
  "llms-and-generative-ai.json",
  "ai-engineering.json",
  "mobile-development.json",
  "cybersecurity.json",
  "data-engineering.json",
  "git-and-version-control.json",
  "testing-and-quality.json",
  "operating-systems.json",
  "computer-networking.json",
  "deep-learning.json",
  "low-level-system-design.json",
  "python-for-engineers.json",
];

const topicCache = new Map<string, Topic>();
let allTopicsCache: Topic[] | null = null;

function topicFiles(): string[] {
  const present = new Set(fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith(".json")));
  const ordered = TOPIC_ORDER.filter((f) => present.has(f));
  for (const f of ordered) present.delete(f);
  return [...ordered, ...[...present].sort()];
}

function readTopicFile(file: string): Topic {
  const cached = topicCache.get(file);
  if (cached) return cached;
  const parsed = JSON.parse(fs.readFileSync(path.join(TOPICS_DIR, file), "utf8")) as Topic;
  topicCache.set(file, parsed);
  return parsed;
}

function loadAllTopics(): Topic[] {
  if (allTopicsCache) return allTopicsCache;
  allTopicsCache = topicFiles().map(readTopicFile);
  return allTopicsCache;
}

/** Id and title of every topic, without holding the trees in memory. */
export type TopicSummary = { id: string; title: string };

let summaryCache: TopicSummary[] | null = null;

/**
 * For nav and footer listings, which need labels only. Reads the same files but
 * discards the bodies, so a listing page never retains 100 parsed trees.
 */
export function getTopicSummaries(): TopicSummary[] {
  if (summaryCache) return summaryCache;
  summaryCache = topicFiles().map((f) => {
    const t = readTopicFile(f);
    return { id: t.root.id, title: t.root.title };
  });
  return summaryCache;
}

function findNode(node: Node, id: string): Node | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

function findPath(node: Node, id: string, trail: Node[]): Node[] | undefined {
  const next = [...trail, node];
  if (node.id === id) return next;
  for (const child of node.children) {
    const found = findPath(child, id, next);
    if (found) return found;
  }
  return undefined;
}

export function countLeaves(node: Node): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

export function countPublished(node: Node): number {
  const self = node.status === "published" ? 1 : 0;
  return node.children.reduce((sum, c) => sum + countPublished(c), self);
}

export function countAll(node: Node): number {
  return node.children.reduce((sum, c) => sum + countAll(c), 1);
}

export function getAllTopics(): Topic[] {
  return loadAllTopics();
}

export function getTopic(topicId: string): Topic | undefined {
  return loadAllTopics().find((t) => t.root.id === topicId);
}

export function getNode(nodeId: string): Node | undefined {
  for (const topic of loadAllTopics()) {
    const found = findNode(topic.root, nodeId);
    if (found) return found;
  }
  return undefined;
}

/** Path from the owning topic's root down to (and including) the given node. */
export function getBreadcrumbPath(nodeId: string): Node[] | undefined {
  for (const topic of loadAllTopics()) {
    const found = findPath(topic.root, nodeId, []);
    if (found) return found;
  }
  return undefined;
}

function flattenIds(node: Node, ids: string[]): void {
  ids.push(node.id);
  for (const child of node.children) flattenIds(child, ids);
}

/** Every node id across every topic, for sitemap generation. */
export function getAllNodeIds(): string[] {
  const ids: string[] = [];
  for (const topic of loadAllTopics()) flattenIds(topic.root, ids);
  return ids;
}

/**
 * The deep-dive half of a node, served separately from the page.
 *
 * Anything rendered inside a client component is serialized into the RSC
 * payload even when CSS hides it, so deep prose cannot be shipped with the page
 * without being paid for. It's fetched on first use instead — same approach as
 * the tree skeleton.
 */
export type { DeepPayload } from "./content-types";
import type { DeepPayload } from "./content-types";

export function getDeepPayload(nodeId: string): DeepPayload | undefined {
  const node = getNode(nodeId);
  if (!node?.deep_text) return undefined;
  return { deep_text: node.deep_text, interview: node.interview };
}

/** Ids of nodes that actually have deep content, so only those get a route. */
export function getDeepNodeIds(): string[] {
  return getAllNodeIds().filter((id) => Boolean(getNode(id)?.deep_text));
}

/** Sibling nodes of the given node within its parent, in order, plus the node's index. */
export function getSiblings(nodeId: string): { siblings: Node[]; index: number } | undefined {
  const trail = getBreadcrumbPath(nodeId);
  if (!trail || trail.length < 2) return undefined;
  const parent = trail[trail.length - 2];
  const index = parent.children.findIndex((c) => c.id === nodeId);
  if (index === -1) return undefined;
  return { siblings: parent.children, index };
}

export type SpineEntry = {
  id: string;
  title: string;
  level: string;
  depth: number;
  /** 1-based position among siblings, and how many siblings there are. */
  position: number;
  of: number;
  childCount: number;
  onPath: boolean;
  isCurrent: boolean;
};

/**
 * The visible skeleton of a topic relative to one node: every ancestor of the
 * node expanded to show its children, everything else left collapsed. Gives
 * the reader depth and position at each level without dumping all 130 nodes.
 */
export function getSpine(topicRoot: Node, currentId: string): SpineEntry[] {
  const trail = findPath(topicRoot, currentId, []) ?? [topicRoot];
  const onPath = new Set(trail.map((n) => n.id));
  const out: SpineEntry[] = [];

  function walk(node: Node, depth: number, position: number, of: number): void {
    out.push({
      id: node.id,
      title: node.title,
      level: node.level,
      depth,
      position,
      of,
      childCount: node.children.length,
      onPath: onPath.has(node.id),
      isCurrent: node.id === currentId,
    });
    // Expand only along the trail; siblings are listed but not opened.
    if (!onPath.has(node.id)) return;
    node.children.forEach((c, i) => walk(c, depth + 1, i + 1, node.children.length));
  }

  walk(topicRoot, 0, 1, 1);
  return out;
}

export type { TreeNode } from "./tree";
import type { TreeNode } from "./tree";

/**
 * The topic tree with every body of text stripped out. The Tree map only draws
 * labelled cards, so shipping deep_text and interview answers for all 130 nodes
 * into the client bundle is pure waste.
 */
export function getTreeSkeleton(node: Node): TreeNode {
  return {
    id: node.id,
    title: node.title,
    level: node.level,
    status: node.status,
    children: node.children.map(getTreeSkeleton),
  };
}

export type SearchEntry = {
  id: string;
  title: string;
  text: string;
  topic: string;
  level: string;
};

function flattenSearchEntries(node: Node, topic: string, out: SearchEntry[]): void {
  out.push({ id: node.id, title: node.title, text: node.text, topic, level: node.level });
  for (const child of node.children) flattenSearchEntries(child, topic, out);
}

/** Flat search index of every node across every topic, for the ⌘K palette. */
export function getSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const topic of loadAllTopics()) flattenSearchEntries(topic.root, topic.root.title, out);
  return out;
}
