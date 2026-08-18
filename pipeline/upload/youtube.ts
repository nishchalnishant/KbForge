/**
 * YouTube Data API v3 upload (resumable upload, category Shorts via #Shorts
 * in description/title + vertical aspect ratio). OAuth credentials do not
 * exist yet (PRD §6 M1) — this throws a clear error until YOUTUBE_* env vars
 * are configured. See pipeline/README.md.
 */
import { readFileSync, statSync } from "node:fs";

export interface YouTubeUploadRequest {
  filePath: string;
  title: string;
  description: string;
}

export interface YouTubeUploadResult {
  videoId: string;
}

export class YouTubeClient {
  private readonly accessToken: string;

  constructor(accessToken = process.env.YOUTUBE_ACCESS_TOKEN ?? "") {
    this.accessToken = accessToken;
  }

  async upload(req: YouTubeUploadRequest): Promise<YouTubeUploadResult> {
    if (!this.accessToken) {
      throw new Error(
        "YOUTUBE_ACCESS_TOKEN is not set — YouTube Data API OAuth app not created yet " +
          "(PRD §6 M1). See pipeline/README.md.",
      );
    }

    const metadata = {
      snippet: { title: req.title, description: req.description },
      status: { privacyStatus: "public" },
    };

    const fileSize = statSync(req.filePath).size;
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Length": String(fileSize),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!initRes.ok) {
      throw new Error(`YouTube upload init failed: ${initRes.status} ${await initRes.text()}`);
    }
    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube upload init did not return a resumable upload URL");

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(fileSize) },
      body: readFileSync(req.filePath),
    });
    if (!uploadRes.ok) {
      throw new Error(`YouTube upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }
    const { id } = (await uploadRes.json()) as { id: string };
    return { videoId: id };
  }
}
