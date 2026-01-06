from mixedbread import Mixedbread


class WebSearch:
    """Web search tool using mixedbread's web store."""

    def __init__(self, api_key: str):
        self.mixedbread = Mixedbread(api_key=api_key)
        self.store_name = "mixedbread/web"

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """
        Search the web using mixedbread's web store.

        Args:
            query: Search query
            top_k: Number of results to return
        """
        resp = self.mixedbread.stores.search(
            store_identifiers=[self.store_name],
            query=query,
            top_k=top_k,
        )
        results = []
        for item in resp.data:
            content = item.text if hasattr(item, "text") else ""
            metadata = item.metadata if hasattr(item, "metadata") else {}

            title = metadata.get("title", "")
            url = metadata.get("url", "") or (item.filename if hasattr(item, "filename") else "")

            results.append({
                "title": title or url,
                "url": url,
                "content": content,
                "score": item.score if hasattr(item, "score") else 0,
            })
        return results

    @staticmethod
    def get_tool() -> list[dict]:
        """Returns tool descriptions for OpenAI Responses API function calling."""
        return [
            {
                "type": "function",
                "name": "web_search",
                "description": "Search the web for current information. Use this when you need up-to-date information, facts, or to research topics beyond your knowledge.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query",
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return (default: 10)",
                        },
                    },
                    "required": ["query"],
                },
            },
        ]
