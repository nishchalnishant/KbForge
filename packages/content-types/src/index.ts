export type NodeLevel = "topic" | "section" | "subsection" | "unit";
export type NodeStatus = "text_only" | "published";

export interface Node {
  id: string;
  level: NodeLevel;
  title: string;
  text: string;
  youtube_video_id?: string;
  status: NodeStatus;
  children: Node[];
}

export interface Topic {
  root: Node;
}

export interface RoadmapReference {
  node_id: string;
}

export interface Roadmap {
  id: string;
  title: string;
  references: RoadmapReference[];
}
