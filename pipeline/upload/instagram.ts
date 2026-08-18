/**
 * Instagram cross-post via Meta Graph API (Reels container publish flow).
 * Per PRD §6 M1/M2, Instagram cross-post stays stubbed through M1 regardless
 * of credential availability — this is a no-op placeholder until M2.
 */
export interface InstagramCrossPostRequest {
  /** publicly reachable URL of the already-uploaded video (Graph API requires a URL, not a file) */
  videoUrl: string;
  caption: string;
}

export interface InstagramCrossPostResult {
  mediaId: string;
}

export class InstagramClient {
  private readonly accessToken: string;
  private readonly igUserId: string;

  constructor(
    accessToken = process.env.META_ACCESS_TOKEN ?? "",
    igUserId = process.env.META_IG_USER_ID ?? "",
  ) {
    this.accessToken = accessToken;
    this.igUserId = igUserId;
  }

  async crossPost(_req: InstagramCrossPostRequest): Promise<InstagramCrossPostResult> {
    if (!this.accessToken || !this.igUserId) {
      throw new Error(
        "META_ACCESS_TOKEN / META_IG_USER_ID not set — Meta Graph API app not created yet " +
          "(PRD §6 M2). Instagram cross-post is stubbed through M1 by design.",
      );
    }

    throw new Error(
      "Instagram cross-post is not implemented yet — deferred to M2 per PRD §6, even once " +
        "credentials exist. Implement the media container create + publish two-step flow here.",
    );
  }
}
