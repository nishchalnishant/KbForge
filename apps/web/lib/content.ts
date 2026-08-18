import type { Node, Topic } from "@kbforge/content-types";
import machineLearning from "../../../content/topics/machine-learning.json";
import frontend from "../../../content/topics/frontend.json";

const TOPICS = [machineLearning, frontend] as unknown as Topic[];

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
