"use client";

import { useState, useEffect, useCallback } from "react";

interface SearchResult {
  path: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

function getTypeFromPath(path: string): string {
  if (path.startsWith("/todos/")) return "todo";
  if (path.startsWith("/memories/")) return "memory";
  if (path.startsWith("/projects/")) return "project";
  return "file";
}

function getTypeColor(type: string): string {
  switch (type) {
    case "todo":
      return "bg-[#c45d3a]";
    case "memory":
      return "bg-[#3a7bc4]";
    case "project":
      return "bg-[#3ac45d]";
    default:
      return "bg-[#888]";
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/search?q=${encodeURIComponent(q)}&top_k=20`
      );
      const data = await res.json();
      setResults(data);
      setSearched(true);
    } catch (e) {
      console.error("Search failed", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(debounce(search, 300), [search]);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return (
    <div className="min-h-screen bg-[#faf9f7] p-12 text-[#1a1a1a]">
      <div className="mx-auto max-w-2xl">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search everything..."
          autoFocus
          className="w-full bg-white/50 backdrop-blur border border-[#e8e6e3] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.02)] px-4 py-3 text-sm outline-none placeholder:text-[#c4c4c4] focus:border-[#c45d3a] focus:shadow-[0_2px_8px_rgba(196,93,58,0.06)] transition-all mb-8"
        />

        {loading && (
          <div className="text-[#a8a8a8]">searching...</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-[#c4c4c4]">no results</div>
        )}

        {!loading && results.length > 0 && (
          <ul className="space-y-6">
            {results.map((result, i) => {
              const type = getTypeFromPath(result.path);
              const name = result.path.split("/").pop()?.replace(".md", "") || result.path;
              const snippet = result.content
                .replace(/^# .+\n\n?/, "")
                .slice(0, 200)
                .trim();

              return (
                <li key={i} className="group">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 px-2 py-0.5 text-xs text-white rounded ${getTypeColor(type)}`}
                    >
                      {type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{name}</div>
                      <div className="text-sm text-[#666] mt-1 line-clamp-2">
                        {snippet || "(no content)"}
                      </div>
                      <div className="text-xs text-[#a8a8a8] mt-2">
                        {result.path}
                        <span className="ml-3">
                          score: {(result.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
