import type { Node, Topic } from "@kbforge/content-types";
import machineLearning from "../../../content/topics/machine-learning.json";
import frontend from "../../../content/topics/frontend.json";
import backendEngineering from "../../../content/topics/backend-engineering.json";
import databases from "../../../content/topics/databases.json";
import systemDesign from "../../../content/topics/system-design.json";
import devops from "../../../content/topics/devops.json";
import cloudComputing from "../../../content/topics/cloud-computing.json";
import dataStructuresAndAlgorithms from "../../../content/topics/data-structures-and-algorithms.json";
import llmsAndGenerativeAi from "../../../content/topics/llms-and-generative-ai.json";
import aiEngineering from "../../../content/topics/ai-engineering.json";
import mobileDevelopment from "../../../content/topics/mobile-development.json";
import cybersecurity from "../../../content/topics/cybersecurity.json";
import dataEngineering from "../../../content/topics/data-engineering.json";
import gitAndVersionControl from "../../../content/topics/git-and-version-control.json";
import testingAndQuality from "../../../content/topics/testing-and-quality.json";
import operatingSystems from "../../../content/topics/operating-systems.json";
import computerNetworking from "../../../content/topics/computer-networking.json";
import deepLearning from "../../../content/topics/deep-learning.json";
import lowLevelSystemDesign from "../../../content/topics/low-level-system-design.json";
import pythonForEngineers from "../../../content/topics/python-for-engineers.json";

const TOPICS = [
  machineLearning,
  frontend,
  backendEngineering,
  databases,
  systemDesign,
  devops,
  cloudComputing,
  dataStructuresAndAlgorithms,
  llmsAndGenerativeAi,
  aiEngineering,
  mobileDevelopment,
  cybersecurity,
  dataEngineering,
  gitAndVersionControl,
  testingAndQuality,
  operatingSystems,
  computerNetworking,
  deepLearning,
  lowLevelSystemDesign,
  pythonForEngineers,
] as unknown as Topic[];

function loadAllTopics(): Topic[] {
  return TOPICS;
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

/** Sibling nodes of the given node within its parent, in order, plus the node's index. */
export function getSiblings(nodeId: string): { siblings: Node[]; index: number } | undefined {
  const trail = getBreadcrumbPath(nodeId);
  if (!trail || trail.length < 2) return undefined;
  const parent = trail[trail.length - 2];
  const index = parent.children.findIndex((c) => c.id === nodeId);
  if (index === -1) return undefined;
  return { siblings: parent.children, index };
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
