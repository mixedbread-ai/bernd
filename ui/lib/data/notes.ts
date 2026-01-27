// Pure functions for fetching notes data

import type { Note } from "@/types";
import { PATHS } from "../constants";
import type { FileListItem, SemanticFS } from "../services/semantic-fs";

function pathToId(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(".md", "");
}

function fileToNote(file: FileListItem): Note {
  const metadata = file.metadata;
  return {
    id: pathToId(file.path),
    title: file.path.split("/").pop()?.replace(".md", "") ?? "",
    content: undefined, // Content not loaded in list view
    updated_at: (metadata.updated_at as string) ?? undefined,
  };
}

export async function getNotes(fs: SemanticFS, limit = 50): Promise<Note[]> {
  const files = await fs.list(PATHS.NOTES, limit);
  return files.map(fileToNote).sort((a, b) => {
    // Sort by updated_at descending (most recent first)
    if (a.updated_at && b.updated_at) {
      return b.updated_at.localeCompare(a.updated_at);
    }
    if (a.updated_at) return -1;
    if (b.updated_at) return 1;
    return a.title.localeCompare(b.title);
  });
}

export async function getNote(
  fs: SemanticFS,
  id: string,
): Promise<Note | null> {
  const result = await fs.read(`${PATHS.NOTES}/${id}.md`);
  if ("error" in result) {
    return null;
  }

  return {
    id,
    title: id,
    content: result.content,
    updated_at: (result.metadata.updated_at as string) ?? undefined,
  };
}

export async function searchNotes(
  fs: SemanticFS,
  query: string,
  topK = 10,
): Promise<Note[]> {
  const results = await fs.search(query, PATHS.NOTES, topK);
  return results.map((result) => ({
    id: pathToId(result.path),
    title: result.path.split("/").pop()?.replace(".md", "") ?? "",
    content: result.content,
    updated_at: (result.metadata.updated_at as string) ?? undefined,
  }));
}
