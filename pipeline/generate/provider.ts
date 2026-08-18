/**
 * Provider layer.
 *
 * Two things changed from the original single-provider design:
 *
 * 1. **Model routing.** Planning, judging and verification are reasoning-heavy
 *    and low-volume; content fill is the opposite. Running both on one model
 *    means either overpaying for prose or under-thinking the outline that 65
 *    downstream calls depend on. Stages now ask for a tier, not a model.
 *
 * 2. **Resilience.** A 1,300-node run makes transient 429/5xx responses a
 *    certainty, not a possibility. Every request retries with exponential
 *    backoff and honours Retry-After.
 *
 * The transport is the OpenAI chat-completions shape, which NVIDIA
 * build.nvidia.com, OpenAI, OpenRouter, Together, Groq and most gateways all
 * speak — so switching vendor is env vars, not code.
 */

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  /** Optional system prompt. Ignored by providers that don't support one. */
  system?: string;
}

export interface ContentProvider {
  generateNodeContent(prompt: string, opts?: GenerateOptions): Promise<string>;
}

/**
 * reasoning — research, outline generation, judging, verification.
 * standard  — contracts, structure-adjacent calls.
 * fast      — per-node content fill (the volume stage).
 */
export type ModelTier = "reasoning" | "standard" | "fast";

export type ProviderSet = Record<ModelTier, ContentProvider>;

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

export interface OpenAICompatibleConfig {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  /** Env var name quoted in the "not set" error, so the message is actionable. */
  apiKeyEnvName?: string;
  maxRetries?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export class OpenAICompatibleProvider implements ContentProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiKeyEnvName: string;
  private readonly maxRetries: number;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(config: OpenAICompatibleConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.model;
    this.apiKeyEnvName = config.apiKeyEnvName ?? "NVIDIA_API_KEY";
    this.maxRetries = config.maxRetries ?? 5;
    this.defaultTemperature = config.defaultTemperature ?? 0.4;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 2048;
  }

  describe(): string {
    return `${this.model} @ ${this.baseUrl}`;
  }

  async generateNodeContent(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new Error(`${this.apiKeyEnvName} is not set — see pipeline/README.md`);
    }

    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: prompt });

    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: opts.temperature ?? this.defaultTemperature,
      max_tokens: opts.maxTokens ?? this.defaultMaxTokens,
    });

    let lastError = "";

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        });
      } catch (err) {
        // Network-level failure — retryable.
        lastError = `network error: ${(err as Error).message}`;
        await sleep(backoffMs(attempt));
        continue;
      }

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content ?? "";
      }

      const text = await res.text();
      lastError = `${res.status} ${text.slice(0, 400)}`;

      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      if (!retryable || attempt === this.maxRetries) break;

      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
    }

    throw new Error(`LLM request failed after ${this.maxRetries + 1} attempts (${this.model}): ${lastError}`);
  }
}

/**
 * Kept so existing callers (generate/index.ts and anything importing it) keep
 * working unchanged. It's now just a preconfigured OpenAICompatibleProvider.
 */
export class NemotronProvider extends OpenAICompatibleProvider {
  constructor(apiKey = process.env.NVIDIA_API_KEY ?? "", model = process.env.KBFORGE_MODEL_FAST ?? "nvidia/nemotron-4-340b-instruct") {
    super({ apiKey, model, apiKeyEnvName: "NVIDIA_API_KEY" });
  }
}

function backoffMs(attempt: number): number {
  // 1s, 2s, 4s, 8s, 16s with jitter, capped at 30s.
  const base = Math.min(1000 * 2 ** attempt, 30_000);
  return base + Math.floor(Math.random() * 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the three-tier provider set from the environment.
 *
 *   KBFORGE_LLM_BASE_URL    default https://integrate.api.nvidia.com/v1
 *   KBFORGE_LLM_API_KEY     falls back to NVIDIA_API_KEY
 *   KBFORGE_MODEL_REASONING / _STANDARD / _FAST
 *
 * If only NVIDIA_API_KEY is set, all three tiers point at Nemotron and the
 * pipeline behaves exactly as before — routing is an optimisation, not a
 * requirement to get a first run out.
 */
export function resolveProviders(): ProviderSet {
  const baseUrl = process.env.KBFORGE_LLM_BASE_URL ?? DEFAULT_BASE_URL;
  const apiKey = process.env.KBFORGE_LLM_API_KEY ?? process.env.NVIDIA_API_KEY ?? "";
  const apiKeyEnvName = process.env.KBFORGE_LLM_API_KEY ? "KBFORGE_LLM_API_KEY" : "NVIDIA_API_KEY";

  const fastModel = process.env.KBFORGE_MODEL_FAST ?? "nvidia/nemotron-4-340b-instruct";
  const standardModel = process.env.KBFORGE_MODEL_STANDARD ?? fastModel;
  const reasoningModel = process.env.KBFORGE_MODEL_REASONING ?? standardModel;

  const make = (model: string, defaultTemperature: number, defaultMaxTokens: number) =>
    new OpenAICompatibleProvider({ baseUrl, apiKey, model, apiKeyEnvName, defaultTemperature, defaultMaxTokens });

  return {
    reasoning: make(reasoningModel, 0.5, 4096),
    standard: make(standardModel, 0.4, 2048),
    fast: make(fastModel, 0.4, 2048),
  };
}

/** A ProviderSet where every tier is the same provider — used by tests and by
 *  callers that explicitly pass a single provider for the whole run. */
export function uniformProviders(provider: ContentProvider): ProviderSet {
  return { reasoning: provider, standard: provider, fast: provider };
}
