export type NodeLevel = "topic" | "section" | "subsection" | "unit";
export type NodeStatus = "text_only" | "published";

/**
 * What a node must and must not cover. Assigned by the contracts stage of the
 * authoring pipeline so sibling nodes don't re-explain each other's material —
 * the single biggest source of redundancy when each node is written with only
 * its parent's text as context.
 */
export interface NodeContract {
  /** One line: the specific thing this node is responsible for teaching. */
  must_cover: string;
  /** Material owned by a sibling, which this node may reference but must not explain. */
  must_not_cover: string[];
}

export type VerificationCheck = "facts" | "duplication" | "contract";
export type VerificationSeverity = "blocker" | "warning";

export interface VerificationIssue {
  check: VerificationCheck;
  severity: VerificationSeverity;
  detail: string;
}

export interface NodeVerification {
  /** ISO timestamp of the verification run. */
  checked_at: string;
  /** True when no blocker-severity issue was raised. */
  passed: boolean;
  issues: VerificationIssue[];
}

export interface InterviewQuestion {
  question: string;
  answer: string;
}

export interface Node {
  id: string;
  level: NodeLevel;
  title: string;
  /** The short read — the "under a minute" version, shown by default. */
  text: string;
  /** The long read, revealed by LessonPanel's Short / Deep dive toggle. */
  deep_text?: string;
  /** "How this gets asked in interviews" — units only. */
  interview?: InterviewQuestion[];
  /** Coverage contract assigned before content fill. */
  contract?: NodeContract;
  /** Node ids that should be understood before this one. Cross-topic allowed. */
  prerequisites?: string[];
  /** Other node ids covering substantially the same concept (PRD §3 Reference). */
  same_as?: string[];
  /** Result of the verification stage. */
  verification?: NodeVerification;
  /** True when verification raised a blocker and a human has not yet cleared it. */
  needs_review?: boolean;
  youtube_video_id?: string;
  status: NodeStatus;
  children: Node[];
}

/** Provenance and planning artifacts for a topic, kept so runs are resumable. */
export interface TopicMeta {
  title: string;
  audience: string;
  summary: string;
  boundaries: string[];
  /** Grounding brief produced by the research stage. */
  research?: string;
  /** Sources the research stage drew on. */
  sources?: string[];
  /** ISO timestamp of the last authoring run that touched this topic. */
  authored_at?: string;
}

export interface Topic {
  root: Node;
  meta?: TopicMeta;
}

export interface RoadmapReference {
  node_id: string;
}

export interface Roadmap {
  id: string;
  title: string;
  references: RoadmapReference[];
}
