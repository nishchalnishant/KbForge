import type { ContentProvider } from "../generate/provider.ts";

/**
 * Asks the provider for strict JSON and parses it, stripping the markdown
 * code fences models commonly wrap JSON responses in.
 */
export async function completeJson<T>(provider: ContentProvider, prompt: string): Promise<T> {
  const raw = await provider.generateNodeContent(prompt);
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`completeJson: failed to parse LLM response as JSON: ${(err as Error).message}\n---\n${raw}`);
  }
}
