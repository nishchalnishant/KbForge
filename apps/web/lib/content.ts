import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node, Topic } from "@kbforge/content-types";

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content");

function loadAllTopics(): Topic[] {
  const dir = join(CONTENT_DIR, "topics");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Topic);
}

function findNode(node: Node, id: string): Node | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
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
