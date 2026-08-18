import type { ContentProvider, GenerateOptions } from "../generate/provider.ts";

export interface CompleteJsonOptions extends GenerateOptions {
  /** How many times to re-ask when the response isn't parseable JSON. */
  attempts?: number;
  /** Optional shape validator. Returning a string rejects the parse and triggers a retry. */
  validate?: (value: unknown) => string | null;
}

/**
 * Asks the provider for strict JSON and parses it.
 *
 * Models wrap JSON in fences, prefix it with "Here's the JSON:", and
 * occasionally emit trailing commas. Over a 1,300-node run every one of those
 * happens, so this extracts the JSON rather than assuming the whole response is
 * JSON, and re-asks with the parse error attached when extraction fails.
 */
export async function completeJson<T>(
  provider: ContentProvider,
  prompt: string,
  opts: CompleteJsonOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const { attempts: _ignored, validate, ...generateOpts } = opts;

  let lastRaw = "";
  let lastProblem = "";

  for (let attempt = 0; attempt < attempts; attempt++) {
    const askFor =
      attempt === 0
        ? prompt
        : [
            prompt,
            "",
            "Your previous response could not be used. Problem:",
            lastProblem,
            "",
            "Respond with the JSON value only. No prose, no markdown fences, no trailing commas.",
          ].join("\n");

    lastRaw = await provider.generateNodeContent(askFor, generateOpts);

    const candidate = extractJson(lastRaw);
    if (!candidate) {
      lastProblem = "no JSON object or array was found in the response";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch (err) {
      lastProblem = `JSON.parse failed: ${(err as Error).message}`;
      continue;
    }

    const invalid = validate?.(parsed) ?? null;
    if (invalid) {
      lastProblem = invalid;
      continue;
    }

    return parsed as T;
  }

  throw new Error(
    `completeJson: gave up after ${attempts} attempts. Last problem: ${lastProblem}\n--- last response ---\n${lastRaw.slice(0, 1500)}`,
  );
}

/**
 * Pulls the first balanced JSON object or array out of a response, ignoring
 * braces that appear inside strings.
 */
export function extractJson(raw: string): string | null {
  const text = raw.replace(/^﻿/, "");
  const start = firstIndexOfAny(text, ["{", "["]);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return stripTrailingCommas(text.slice(start, i + 1));
    }
  }

  return null;
}

function firstIndexOfAny(text: string, chars: string[]): number {
  const found = chars.map((c) => text.indexOf(c)).filter((i) => i !== -1);
  return found.length ? Math.min(...found) : -1;
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}
