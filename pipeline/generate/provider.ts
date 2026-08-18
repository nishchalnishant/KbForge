export interface ContentProvider {
  generateNodeContent(prompt: string): Promise<string>;
}

/**
 * NVIDIA Nemotron via build.nvidia.com — PRD §4 stage 1 provider choice.
 * Swappable: anything implementing ContentProvider can replace this without
 * touching generate/index.ts.
 */
export class NemotronProvider implements ContentProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey = process.env.NVIDIA_API_KEY ?? "", model = "nvidia/nemotron-4-340b-instruct") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateNodeContent(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("NVIDIA_API_KEY is not set — see pipeline/README.md");
    }

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      throw new Error(`Nemotron request failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message.content ?? "";
  }
}
