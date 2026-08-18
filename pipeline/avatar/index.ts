import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HeyGenClient } from "./heygen.ts";
import { compositePip } from "./composite.ts";

const STAGE_DIR = dirname(fileURLToPath(import.meta.url));

export interface AvatarRenderOptions {
  nodeId: string;
  script: string;
  screenRecordingPath: string;
  outDir?: string;
  avatarId?: string;
  voiceId?: string;
}

/**
 * Full avatar stage: render narration via HeyGen, download the clip,
 * composite it PIP over the screen recording. Throws with a clear message
 * if HEYGEN_API_KEY isn't set (PRD §6 M1 — credential setup not done yet).
 */
export async function renderAvatarForNode(opts: AvatarRenderOptions): Promise<string> {
  const client = new HeyGenClient();
  const avatarId = opts.avatarId ?? process.env.HEYGEN_AVATAR_ID ?? "";
  const voiceId = opts.voiceId ?? process.env.HEYGEN_VOICE_ID ?? "";
  if (!avatarId || !voiceId) {
    throw new Error("HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID not set — clone avatar not created yet (PRD §6 M1).");
  }

  const avatarClipUrl = await client.renderAvatarClip({ avatarId, voiceId, script: opts.script });
  const avatarClipRes = await fetch(avatarClipUrl);
  const avatarClipBuffer = Buffer.from(await avatarClipRes.arrayBuffer());

  const outDir = opts.outDir ?? join(STAGE_DIR, "out");
  mkdirSync(outDir, { recursive: true });
  const avatarClipPath = join(outDir, `${opts.nodeId}-avatar.mp4`);
  const outPath = join(outDir, `${opts.nodeId}-composited.mp4`);

  writeFileSync(avatarClipPath, avatarClipBuffer);
  await compositePip({ screenRecordingPath: opts.screenRecordingPath, avatarClipPath, outPath });
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("avatar/index.ts exports renderAvatarForNode() for use by the top-level pipeline runner.");
  process.exit(1);
}
