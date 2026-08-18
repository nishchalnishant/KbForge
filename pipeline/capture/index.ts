/**
 * Screen-records a node's live page, scrolling in sync with narration timing.
 * Depends on apps/web already serving the target node (PRD §4) — this cannot
 * run ahead of the site being deployed/running locally for that node.
 *
 * Implementation choice: Playwright's built-in video recording
 * (page.video()) rather than an OS-level screen-capture tool, since it can
 * drive the scroll programmatically and doesn't depend on window focus/OS
 * permissions.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STAGE_DIR = dirname(fileURLToPath(import.meta.url));

export interface CaptureOptions {
  nodeId: string;
  baseUrl?: string;
  outDir?: string;
  /** total capture duration in ms — should match narration length once avatar/ provides it */
  durationMs?: number;
  viewport?: { width: number; height: number };
}

export async function captureNode(opts: CaptureOptions): Promise<string> {
  const baseUrl = opts.baseUrl ?? "http://localhost:3000";
  const outDir = opts.outDir ?? join(STAGE_DIR, "out");
  const durationMs = opts.durationMs ?? 15_000;
  const viewport = opts.viewport ?? { width: 1080, height: 1920 }; // Shorts/Reels aspect

  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: outDir, size: viewport },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/node/${opts.nodeId}`, { waitUntil: "networkidle" });

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const steps = 60;
  const stepDelay = durationMs / steps;

  for (let i = 0; i <= steps; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), (scrollHeight * i) / steps);
    await page.waitForTimeout(stepDelay);
  }

  await context.close();
  await browser.close();

  const video = await page.video();
  const path = await video?.path();
  if (!path) throw new Error(`capture failed for node ${opts.nodeId} — no video path returned`);
  return path;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const nodeId = process.argv[2];
  if (!nodeId) {
    console.error("usage: tsx capture/index.ts <nodeId>");
    process.exit(1);
  }
  captureNode({ nodeId }).then((path) => console.log(`captured: ${path}`));
}
