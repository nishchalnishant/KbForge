import { YouTubeClient } from "./youtube.ts";
import { InstagramClient } from "./instagram.ts";

export interface UploadOptions {
  filePath: string;
  title: string;
  description: string;
  /** cross-post to Instagram after YouTube upload succeeds — off by default, PRD §6 M2 */
  crossPostInstagram?: boolean;
}

export interface UploadResult {
  youtubeVideoId: string;
  instagramMediaId?: string;
}

export async function uploadNode(opts: UploadOptions): Promise<UploadResult> {
  const youtube = new YouTubeClient();
  const { videoId } = await youtube.upload({
    filePath: opts.filePath,
    title: opts.title,
    description: opts.description,
  });

  let instagramMediaId: string | undefined;
  if (opts.crossPostInstagram) {
    const instagram = new InstagramClient();
    const { mediaId } = await instagram.crossPost({
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      caption: opts.description,
    });
    instagramMediaId = mediaId;
  }

  return { youtubeVideoId: videoId, instagramMediaId };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("upload/index.ts exports uploadNode() for use by the top-level pipeline runner.");
  process.exit(1);
}
