import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background:
            "radial-gradient(circle at 20% 0%, rgba(255, 176, 0, 0.15), transparent 28rem), radial-gradient(circle at 92% 18%, rgba(61, 244, 196, 0.1), transparent 24rem), linear-gradient(135deg, #080907 0%, #10120e 48%, #090b0d 100%)",
          color: "#f7f4ed",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, color: "#ffb000" }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ffb000" }} />
          learnforge<span style={{ color: "#8a9386" }}>.fyi</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
            Learn things properly,
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.1,
              background: "linear-gradient(135deg, #ffb000, #3df4c4)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            one node at a time.
          </span>
        </div>
        <div style={{ display: "flex", gap: 48, fontSize: 24, color: "#8a9386" }}>
          <span>
            <strong style={{ color: "#f7f4ed", fontSize: 32 }}>20</strong> topics
          </span>
          <span>
            <strong style={{ color: "#f7f4ed", fontSize: 32 }}>88+</strong> concepts
          </span>
          <span>
            <strong style={{ color: "#f7f4ed", fontSize: 32 }}>0</strong> accounts needed
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
