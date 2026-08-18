/**
 * HeyGen API client — PRD §4 stage 2 avatar provider choice.
 * REST API: create a video generation job from an avatar_id + script text,
 * poll for completion, download the rendered (plain rectangular) clip.
 * No alpha/transparent output — PIP masking happens locally in composite.ts.
 */
const HEYGEN_API_BASE = "https://api.heygen.com/v2";

export interface HeyGenRenderRequest {
  avatarId: string;
  voiceId: string;
  script: string;
}

export class HeyGenClient {
  private readonly apiKey: string;

  constructor(apiKey = process.env.HEYGEN_API_KEY ?? "") {
    this.apiKey = apiKey;
  }

  private get configured(): boolean {
    return this.apiKey.length > 0;
  }

  async renderAvatarClip(req: HeyGenRenderRequest): Promise<string> {
    if (!this.configured) {
      throw new Error(
        "HEYGEN_API_KEY is not set — avatar rendering is stubbed until a HeyGen account " +
          "exists (PRD §6 M1). See pipeline/README.md.",
      );
    }

    const createRes = await fetch(`${HEYGEN_API_BASE}/video/generate`, {
      method: "POST",
      headers: { "X-Api-Key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { type: "avatar", avatar_id: req.avatarId },
            voice: { type: "text", input_text: req.script, voice_id: req.voiceId },
          },
        ],
      }),
    });
    if (!createRes.ok) {
      throw new Error(`HeyGen render request failed: ${createRes.status} ${await createRes.text()}`);
    }
    const { data } = (await createRes.json()) as { data: { video_id: string } };
    return this.pollUntilDone(data.video_id);
  }

  private async pollUntilDone(videoId: string): Promise<string> {
    const pollIntervalMs = 5_000;
    const maxAttempts = 60; // 5 min ceiling

    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${HEYGEN_API_BASE}/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": this.apiKey },
      });
      const { data } = (await res.json()) as {
        data: { status: "processing" | "completed" | "failed"; video_url?: string };
      };
      if (data.status === "completed" && data.video_url) return data.video_url;
      if (data.status === "failed") throw new Error(`HeyGen render failed for video ${videoId}`);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`HeyGen render timed out for video ${videoId}`);
  }
}
