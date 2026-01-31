import type { FileMetadata } from "@/types";
import { PATHS } from "../constants";
import type { FileListItem, SemanticFS } from "../services/semantic-fs";

export interface FileEntry {
  path: string;
  name: string;
  isFolder: boolean;
  metadata: FileMetadata;
}

function fileToEntry(file: FileListItem, basePath: string): FileEntry {
  const relativePath = file.path.replace(basePath, "").replace(/^\//, "");
  const parts = relativePath.split("/");
  const name = parts[0];
  const isFolder = parts.length > 1;

  return {
    path: file.path,
    name,
    isFolder,
    metadata: file.metadata,
  };
}

export async function listFiles(
  fs: SemanticFS,
  path = PATHS.FILES,
  limit = 100,
): Promise<FileEntry[]> {
  const files = await fs.list(path, limit);
  const basePath = path.endsWith("/") ? path : `${path}/`;

  // Deduplicate folders
  const seen = new Set<string>();
  const entries: FileEntry[] = [];

  for (const file of files) {
    const entry = fileToEntry(file, basePath);

    // Skip if we've already seen this folder
    if (entry.isFolder) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
    }

    entries.push(entry);
  }

  // Sort: folders first, then by name
  return entries.sort((a, b) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function downloadFile(
  fs: SemanticFS,
  path: string,
): Promise<{ content: string; metadata: FileMetadata }> {
  const result = await fs.read(path);
  return {
    content: result.content,
    metadata: result.metadata,
  };
}

export async function downloadBinaryFile(
  fs: SemanticFS,
  path: string,
): Promise<{ data: ArrayBuffer; metadata: FileMetadata }> {
  const result = await fs.readBinary(path);
  return {
    data: result.data,
    metadata: result.metadata,
  };
}
