// Pure functions for fetching notes data

import type { Note, NoteMetadata } from "@/types";
import { isNoteMetadata } from "@/types";
import { PATHS } from "../constants";
import type { FileListItem, SemanticFS } from "../services/semantic-fs";

function pathToId(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(".md", "");
}

function noteMetadataToNote(
  id: string,
  metadata: NoteMetadata,
  content?: string,
): Note {
  return {
    id,
    title: metadata.title,
    content,
    updated_at: metadata.updated_at,
  };
}

function fileToNote(file: FileListItem): Note {
  const metadata = file.metadata;
  if (isNoteMetadata(metadata)) {
    return noteMetadataToNote(pathToId(file.path), metadata);
  }
  throw new Error(`Expected note metadata, got ${metadata.type}`);
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

  const metadata = result.metadata;
  if (!isNoteMetadata(metadata)) {
    throw new Error(`Expected note metadata, got ${metadata.type}`);
  }

  return noteMetadataToNote(id, metadata, result.content);
}

export async function searchNotes(
  fs: SemanticFS,
  query: string,
  topK = 10,
): Promise<Note[]> {
  const results = await fs.search(query, PATHS.NOTES, topK);
  return results.map((result) => {
    const metadata = result.metadata;
    if (isNoteMetadata(metadata)) {
      return noteMetadataToNote(
        pathToId(result.path),
        metadata,
        result.content,
      );
    }
    throw new Error(`Expected note metadata, got ${metadata.type}`);
  });
}
