import Mixedbread from "@mixedbread/sdk";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export class WebSearch {
  private client: Mixedbread;
  private storeName = "mixedbread/web";

  constructor(apiKey: string) {
    this.client = new Mixedbread({ apiKey });
  }

  async search(query: string, topK = 10): Promise<WebSearchResult[]> {
    const resp = await this.client.stores.search({
      store_identifiers: [this.storeName],
      query,
      top_k: topK,
    });

    return (resp.data ?? []).map((item) => {
      // Handle different chunk types
      let content = "";
      if ("text" in item && typeof item.text === "string") {
        content = item.text;
      }

      const metadata = (item.metadata as Record<string, unknown>) ?? {};
      const title = (metadata.title as string) ?? "";
      const url = (metadata.url as string) ?? item.filename ?? "";

      return {
        title,
        url,
        content,
        score: item.score ?? 0,
      };
    });
  }
}
