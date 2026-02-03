import type { FileMetadata } from "@/types";
import type { SemanticFS } from "@/lib/services/semantic-fs";

export interface SearchAllResult {
  path: string;
  score: number;
  content: string;
  metadata: FileMetadata;
  type: "todo" | "note" | "memory" | "file" | "chat";
}

function inferType(metadata: FileMetadata): SearchAllResult["type"] {
  switch (metadata.type) {
    case "todo":
    case "note":
    case "memory":
    case "chat":
    case "file":
      return metadata.type;
    default:
      return "file";
  }
}

export async function searchAll(
  fs: SemanticFS,
  query: string,
  topK = 20,
): Promise<SearchAllResult[]> {
  // Search across all content
  const results = await fs.search(query, "/", topK);

  return results.map((result) => ({
    path: result.path,
    score: result.score,
    content: result.content,
    metadata: result.metadata,
    type: inferType(result.metadata),
  }));
}

export async function searchByType(
  fs: SemanticFS,
  query: string,
  type: SearchAllResult["type"],
  topK = 10,
): Promise<SearchAllResult[]> {
  const prefixMap: Record<SearchAllResult["type"], string> = {
    todo: "/todos",
    note: "/notes",
    memory: "/memories",
    file: "/files",
    chat: "/chats",
  };

  const results = await fs.search(query, prefixMap[type], topK);

  return results.map((result) => ({
    path: result.path,
    score: result.score,
    content: result.content,
    metadata: result.metadata,
    type,
  }));
}
