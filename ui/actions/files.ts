"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
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

    if (isFolder) {
      if (seen.has(name)) continue;
      seen.add(name);
      items.push({
        name,
        path: `${path}/${name}`,
        type: "folder",
      });
    } else {
      items.push({
        name,
        path: file.path,
        type: "file",
        size: file.metadata.size as number | undefined,
        mime_type: file.metadata.mime_type as string | undefined,
        created_at: file.metadata.created_at as string | undefined,
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

  return {
    content: result.content,
    mimeType: (result.metadata.mime_type as string) || "text/plain",
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

  return {
    data,
    mimeType:
      (result.metadata.mime_type as string) || "application/octet-stream",
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

  const result = await fs.write(fullPath, content, {
    type: "file",
    ...metadata,
  });

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

  const result = await fs.writeBinary(fullPath, data, mimeType, {
    type: "file",
    mime_type: mimeType,
    ...metadata,
  });

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

  // Create a placeholder file to represent the folder
  const result = await fs.write(`${fullPath}/.folder`, " ", {
    type: "folder",
  });

  revalidatePath("/files");
  return result;
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
