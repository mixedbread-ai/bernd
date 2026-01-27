"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchAction } from "@/actions/search";
import type { SearchAllResult } from "@/lib/data/search";

function getTypeColor(type: string): string {
	switch (type) {
		case "todo":
			return "bg-accent";
		case "memory":
			return "bg-[#3a7bc4]";
		case "note":
			return "bg-[#3ac45d]";
		default:
			return "bg-muted";
	}
}

export default function SearchPage() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchAllResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	const search = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			setSearched(false);
			return;
		}

		setLoading(true);
		try {
			const data = await searchAction(q, 20);
			setResults(data);
			setSearched(true);
		} catch (e) {
			console.error("Search failed", e);
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			search(query);
		}, 300);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [query, search]);

	return (
		<div className="min-h-screen p-4 md:p-12 bg-background text-foreground">
			<div className="mx-auto max-w-2xl">
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="search everything..."
					className="w-full rounded-lg shadow-sm px-4 py-3 text-sm outline-none transition-all mb-8 bg-surface border border-border text-foreground focus:border-accent"
				/>

				{loading && <div className="text-muted">searching...</div>}

				{!loading && searched && results.length === 0 && (
					<div className="text-muted">no results</div>
				)}

				{!loading && results.length > 0 && (
					<ul className="space-y-6">
						{results.map((result) => {
							const name =
								result.path.split("/").pop()?.replace(".md", "") || result.path;
							const snippet = (result.content || "")
								.replace(/^# .+\n\n?/, "")
								.slice(0, 200)
								.trim();

							return (
								<li key={result.path} className="group">
									<div className="flex items-start gap-3">
										<span
											className={`mt-1.5 px-2 py-0.5 text-xs text-white rounded ${getTypeColor(result.type)}`}
										>
											{result.type}
										</span>
										<div className="flex-1 min-w-0">
											<div className="font-medium text-foreground">{name}</div>
											<div className="text-sm mt-1 line-clamp-2 text-muted">
												{snippet || "(no content)"}
											</div>
											<div className="text-xs mt-2 text-muted">
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
