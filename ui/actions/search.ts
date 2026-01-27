"use server";

import { getFS } from "@/lib/context";
import { type SearchAllResult, searchAll } from "@/lib/data/search";

export async function searchAction(
	query: string,
	topK = 20,
): Promise<SearchAllResult[]> {
	if (!query.trim()) {
		return [];
	}

	const fs = await getFS();
	return searchAll(fs, query, topK);
}
