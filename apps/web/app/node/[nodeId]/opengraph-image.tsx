import { ImageResponse } from "next/og";
import { getNode, getBreadcrumbPath } from "@/lib/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { nodeId: string } }) {
  const node = getNode(params.nodeId);
  const trail = node ? getBreadcrumbPath(params.nodeId) : null;
  const topic = trail?.[0]?.title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#080907",
          color: "#f7f4ed",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, color: "#ffb000" }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ffb000" }} />
          learnforge<span style={{ color: "#8a9386" }}>.fyi</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {topic && (
            <span style={{ fontSize: 30, color: "#3df4c4", textTransform: "uppercase", letterSpacing: 2 }}>
              {topic}
            </span>
          )}
          <span style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            {node?.title ?? "learnforge.fyi"}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
