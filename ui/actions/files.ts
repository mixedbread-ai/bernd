"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import type { FileItem } from "@/types";
import {
  type FileUploadMetadata,
  type FolderMarkerMetadata,
  isFileUploadMetadata,
} from "@/types";

export async function listFilesAction(path: string): Promise<FileItem[]> {
  const fs = await getFS();
  const files = await fs.list(path, 100);
  const basePath = path.endsWith("/") ? path : `${path}/`;

  const seen = new Set<string>();
  const items: FileItem[] = [];

  for (const file of files) {
    const relativePath = file.path.replace(basePath, "").replace(/^\//, "");
    const parts = relativePath.split("/");
    const name = parts[0];
    const isFolder = parts.length > 1;

    // Skip folder marker files
    if (name === "folder_meta.json") continue;

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

  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return items;
}

export async function downloadFileAction(
  path: string,
): Promise<{ content: string; mimeType: string }> {
  const fs = await getFS();
  const result = await fs.read(path);

  const meta = result.metadata;
  return {
    content: result.content,
    mimeType: isFileUploadMetadata(meta) ? meta.mime_type : "text/plain",
  };
}

export async function downloadBinaryFileAction(
  path: string,
): Promise<{ data: number[]; mimeType: string }> {
  const fs = await getFS();
  const result = await fs.readBinary(path);

  // Convert ArrayBuffer to array of numbers for serialization
  const data = Array.from(new Uint8Array(result.data));

  const meta = result.metadata;
  return {
    data,
    mimeType: isFileUploadMetadata(meta)
      ? meta.mime_type
      : "application/octet-stream",
  };
}

export async function uploadFileAction(
  path: string,
  content: string,
  metadata?: Record<string, unknown>,
) {
  const fs = await getFS();

  // Ensure path starts with /files/
  const fullPath = path.startsWith(PATHS.FILES)
    ? path
    : `${PATHS.FILES}${path}`;
  const filename = fullPath.split("/").pop() ?? "unnamed";

  const fileMetadata: Omit<
    FileUploadMetadata,
    "path" | "created_at" | "updated_at"
  > = {
    type: "file",
    mime_type: (metadata?.mime_type as string) ?? "text/plain",
    size: (metadata?.size as number) ?? content.length,
    is_base64: false,
    original_name: (metadata?.original_name as string) ?? filename,
  };
  await fs.write(fullPath, content, fileMetadata);

  revalidatePath("/files");
}

export async function uploadBinaryFileAction(
  path: string,
  data: ArrayBuffer,
  mimeType: string,
  metadata?: Record<string, unknown>,
) {
  const fs = await getFS();

  // Ensure path starts with /files/
  const fullPath = path.startsWith(PATHS.FILES)
    ? path
    : `${PATHS.FILES}${path}`;
  const filename = fullPath.split("/").pop() ?? "unnamed";

  const fileMetadata: Omit<
    FileUploadMetadata,
    "path" | "created_at" | "updated_at"
  > = {
    type: "file",
    mime_type: mimeType,
    size: (metadata?.size as number) ?? data.byteLength,
    is_base64: true,
    original_name: (metadata?.original_name as string) ?? filename,
  };
  await fs.writeBinary(fullPath, data, mimeType, fileMetadata);

  revalidatePath("/files");
}

export async function createFolderAction(path: string) {
  const fs = await getFS();

  // Ensure path starts with /files/
  const fullPath = path.startsWith(PATHS.FILES)
    ? path
    : `${PATHS.FILES}${path}`;
  const folderName = fullPath.split("/").pop() ?? "folder";
  const createdAt = new Date().toISOString();

  const content = JSON.stringify({
    type: "folder",
    name: folderName,
    created_at: createdAt,
  });

  const folderMetadata: Omit<
    FolderMarkerMetadata,
    "path" | "created_at" | "updated_at"
  > = {
    type: "folder_marker",
  };
  await fs.write(`${fullPath}/folder_meta.json`, content, folderMetadata);

  revalidatePath("/files");
}

export async function deleteFileAction(path: string) {
  if (!path.startsWith(PATHS.FILES)) {
    throw new Error("Can only delete files under /files/");
  }
  const fs = await getFS();

  await fs.delete(path);

  revalidatePath("/files");
}

export async function deleteFolderAction(path: string) {
  if (!path.startsWith(PATHS.FILES)) {
    throw new Error("Can only delete folders under /files/");
  }
  const fs = await getFS();

  await fs.clearPrefix(path);

  revalidatePath("/files");
}
