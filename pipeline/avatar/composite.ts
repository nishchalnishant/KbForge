/**
 * Local PIP compositing via ffmpeg — none of the evaluated avatar providers
 * reliably support alpha/transparent output, so the plain rectangular avatar
 * clip is cropped to a circle and composited over the screen recording here.
 */
import { spawn } from "node:child_process";

export interface CompositeOptions {
  screenRecordingPath: string;
  avatarClipPath: string;
  outPath: string;
  /** avatar circle diameter as a fraction of output width */
  avatarScale?: number;
  position?: "bottom-right" | "bottom-left";
}

export function compositePip(opts: CompositeOptions): Promise<void> {
  const scale = opts.avatarScale ?? 0.32;
  const position = opts.position ?? "bottom-right";
  const overlayXY =
    position === "bottom-right" ? "main_w-overlay_w-32:main_h-overlay_h-64" : "32:main_h-overlay_h-64";

  // Crop the avatar clip to a square, scale it, mask it into a circle with
  // an alpha channel, then overlay onto the screen recording.
  const filterComplex = [
    `[1:v]crop='min(iw,ih)':'min(iw,ih)',scale=iw*${scale}:ih*${scale}[avatar_scaled]`,
    `[avatar_scaled]format=yuva420p,geq=lum='p(X,Y)':a='if(gt(pow(X-W/2,2)+pow(Y-H/2,2),pow(W/2,2)),0,255)'[avatar_circle]`,
    `[0:v][avatar_circle]overlay=${overlayXY}[out]`,
  ].join(";");

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i",
      opts.screenRecordingPath,
      "-i",
      opts.avatarClipPath,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      opts.outPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
