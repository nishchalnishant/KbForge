import type { MetadataRoute } from "next";
import { getAllNodeIds } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const nodeEntries = getAllNodeIds().map((id) => ({
    url: `${SITE_URL}/node/${id}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...nodeEntries,
  ];
}
