"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchResult } from "../types";
import { API_ENDPOINTS } from "../config";

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
      return "var(--accent)";
    case "memory":
      return "#3a7bc4";
    case "project":
      return "#3ac45d";
    default:
      return "var(--muted)";
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
        `${API_ENDPOINTS.search}?q=${encodeURIComponent(q)}&top_k=20`
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
    <div className="min-h-screen p-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="mx-auto max-w-2xl">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search everything..."
          autoFocus
          className="w-full rounded-lg shadow-sm px-4 py-3 text-sm outline-none transition-all mb-8"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />

        {loading && <div style={{ color: 'var(--muted)' }}>searching...</div>}

        {!loading && searched && results.length === 0 && (
          <div style={{ color: 'var(--muted)' }}>no results</div>
        )}

        {!loading && results.length > 0 && (
          <ul className="space-y-6">
            {results.map((result, i) => {
              const type = getTypeFromPath(result.path);
              const name =
                result.path.split("/").pop()?.replace(".md", "") || result.path;
              const snippet = (result.content || "")
                .replace(/^# .+\n\n?/, "")
                .slice(0, 200)
                .trim();

              return (
                <li key={i} className="group">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1.5 px-2 py-0.5 text-xs text-white rounded"
                      style={{ background: getTypeColor(type) }}
                    >
                      {type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium" style={{ color: 'var(--foreground)' }}>{name}</div>
                      <div className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>
                        {snippet || "(no content)"}
                      </div>
                      <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
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
