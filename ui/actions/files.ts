"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import {
  type FileUploadMetadata,
  type FolderMarkerMetadata,
  isFileUploadMetadata,
} from "@/types";
import type { FileItem } from "../app/files/page";

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
): Promise<{ content: string; mimeType: string } | { error: string }> {
  const fs = await getFS();
  const result = await fs.read(path);

  if ("error" in result) {
    return { error: result.error };
  }

  const meta = result.metadata;
  return {
    content: result.content,
    mimeType: isFileUploadMetadata(meta) ? meta.mime_type : "text/plain",
  };
}

export async function downloadBinaryFileAction(
  path: string,
): Promise<{ data: number[]; mimeType: string } | { error: string }> {
  const fs = await getFS();
  const result = await fs.readBinary(path);

  if ("error" in result) {
    return { error: result.error };
  }

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

export async function uploadFile(
  path: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<{ status: string; path: string }> {
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
  const result = await fs.write(fullPath, content, fileMetadata);

  revalidatePath("/files");
  return result;
}

export async function uploadBinaryFile(
  path: string,
  data: ArrayBuffer,
  mimeType: string,
  metadata?: Record<string, unknown>,
): Promise<{ status: string; path: string }> {
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
  const result = await fs.writeBinary(fullPath, data, mimeType, fileMetadata);

  revalidatePath("/files");
  return result;
}

export async function createFolder(
  path: string,
): Promise<{ status: string; path: string }> {
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
  return { status: "created", path: fullPath };
}

export async function deleteFile(
  path: string,
): Promise<{ status: string; path: string }> {
  const fs = await getFS();

  const result = await fs.delete(path);

  revalidatePath("/files");

  if ("error" in result) {
    return { status: "error", path };
  }
  return result;
}

export async function deleteFolder(
  path: string,
): Promise<{ status: string; prefix: string; deleted: number }> {
  const fs = await getFS();

  const result = await fs.clearPrefix(path);

  revalidatePath("/files");
  return result;
}
