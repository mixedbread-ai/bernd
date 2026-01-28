"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import { isNoteMetadata, type Note, type NoteMetadata } from "@/types";

export interface NoteCreate {
  title: string;
  content?: string;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
}

function generateNoteId(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export async function createNote(
  data: NoteCreate,
): Promise<{ status: string; path: string; id: string }> {
  const fs = await getFS();

  const noteId = generateNoteId();
  const content = data.content || " ";

  const metadata: Omit<NoteMetadata, "path" | "created_at" | "updated_at"> = {
    type: "note",
    title: data.title,
  };
  const result = await fs.write(
    `${PATHS.NOTES}/${noteId}.md`,
    content,
    metadata,
  );

  revalidatePath("/notes");
  return { ...result, id: noteId };
}

export async function updateNote(
  id: string,
  data: NoteUpdate,
): Promise<{ status: string; path: string }> {
  const fs = await getFS();

  const content = data.content || " ";

  const metadata: Omit<NoteMetadata, "path" | "created_at" | "updated_at"> = {
    type: "note",
    title: data.title ?? "",
  };
  const result = await fs.write(`${PATHS.NOTES}/${id}.md`, content, metadata);

  revalidatePath("/notes");
  return result;
}

export async function deleteNote(
  id: string,
): Promise<{ status: string; path: string }> {
  const fs = await getFS();

  const result = await fs.delete(`${PATHS.NOTES}/${id}.md`);

  revalidatePath("/notes");

  if ("error" in result) {
    return { status: "error", path: `${PATHS.NOTES}/${id}.md` };
  }
  return result;
}

export async function getNoteAction(id: string): Promise<Note | null> {
  const fs = await getFS();

  const result = await fs.read(`${PATHS.NOTES}/${id}.md`);
  if ("error" in result) {
    return null;
  }

  const metadata = result.metadata;
  if (!isNoteMetadata(metadata)) {
    throw new Error(`Expected note metadata, got ${metadata.type}`);
  }
  return {
    id,
    title: metadata.title,
    content: result.content,
    updated_at: metadata.updated_at ?? undefined,
  };
}
