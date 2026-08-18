/**
 * Search backends for the research stage.
 *
 * Grounding is the difference between an outline that reflects how a subject is
 * actually taught and one that reflects the model's averaged prior over all
 * internet content about it — which is exactly the generic structure everyone
 * else already publishes.
 *
 * Two hosted backends are supported because both have usable free tiers. If
 * neither key is present the pipeline still runs, but ungrounded, and says so
 * loudly rather than pretending it did research.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<SearchResult[]>;
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";
  constructor(private readonly apiKey: string) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: limit,
        search_depth: "advanced",
        include_answer: false,
      }),
    });
    if (!res.ok) throw new Error(`Tavily search failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: (r.content ?? "").slice(0, 1200),
    }));
  }
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave";
  constructor(private readonly apiKey: string) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(limit));
    const res = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey },
    });
    if (!res.ok) throw new Error(`Brave search failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    return (data.web?.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: (r.description ?? "").slice(0, 1200),
    }));
  }
}

/** No search configured. Research falls back to model recall, flagged as ungrounded. */
export class NullSearchProvider implements SearchProvider {
  readonly name = "none";
  async search(): Promise<SearchResult[]> {
    return [];
  }
}

export function resolveSearchProvider(): SearchProvider {
  const tavily = process.env.TAVILY_API_KEY;
  if (tavily) return new TavilySearchProvider(tavily);
  const brave = process.env.BRAVE_API_KEY;
  if (brave) return new BraveSearchProvider(brave);
  return new NullSearchProvider();
}
