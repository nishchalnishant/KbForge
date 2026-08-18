# content/

Git-tracked structured content. Not a database — see PRD §5.

## Layout

```
content/
  topics/           one JSON file per Topic root, e.g. topics/machine-learning.json
  roadmaps/         one JSON file per Roadmap, e.g. roadmaps/ai-engineer.json
```

## Node shape

Every node — topic, section, subsection, unit — has the same shape (PRD §3):

```ts
type NodeLevel = "topic" | "section" | "subsection" | "unit";
type NodeStatus = "text_only" | "published";

interface Node {
  id: string;              // stable slug, unique across all content
  level: NodeLevel;
  title: string;
  text: string;             // overview (topic/section/subsection) or atomic explanation (unit)
  youtube_video_id?: string; // absent until pipeline/upload backfills it
  status: NodeStatus;
  children: Node[];         // empty for level: "unit"
}
```

A Topic file's root node has `level: "topic"`. A Roadmap file is an ordered list of
references (`{ node_id: string }`) into existing Topic nodes at any depth — it does not
own content (PRD §3).

`pipeline/generate/` writes new Node JSON here. `pipeline/backfill/` patches
`youtube_video_id` + `status` onto existing Node JSON here once a video uploads.
