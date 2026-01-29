import { isFileUploadMetadata } from "@/types";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import { FilesClient } from "./files-client";

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mime_type?: string;
  created_at?: string;
}

async function getFiles(path: string): Promise<FileItem[]> {
  const fs = await getFS();
  const files = await fs.list(path, 100);
  const basePath = path.endsWith("/") ? path : `${path}/`;

  // Convert to expected format and deduplicate folders
  const seen = new Set<string>();
  const items: FileItem[] = [];

  for (const file of files) {
    const relativePath = file.path.replace(basePath, "").replace(/^\//, "");
    const parts = relativePath.split("/");
    const name = parts[0];
    const isFolder = parts.length > 1;

    if (isFolder) {
      if (seen.has(name)) continue;
      seen.add(name);
      items.push({
        name,
        path: `${path}/${name}`,
        type: "folder",
      });
    } else {
      const meta = file.metadata;
      items.push({
        name,
        path: file.path,
        type: "file",
        size: isFileUploadMetadata(meta) ? meta.size : undefined,
        mime_type: isFileUploadMetadata(meta) ? meta.mime_type : undefined,
        created_at: meta.created_at ?? undefined,
      });
    }
  }

  // Sort: folders first, then by name
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return items;
}

export default async function FilesPage() {
  const initialItems = await getFiles(PATHS.FILES);

  return <FilesClient initialItems={initialItems} initialPath={PATHS.FILES} />;
}
