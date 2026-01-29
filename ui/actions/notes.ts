"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function createNoteAction(data: NoteCreate) {
  const fs = await getFS();

  const noteId = generateNoteId();
  const content = data.content || " ";

  const metadata: Omit<NoteMetadata, "path" | "created_at" | "updated_at"> = {
    type: "note",
    title: data.title,
  };
  await fs.write(`${PATHS.NOTES}/${noteId}.md`, content, metadata);

  revalidatePath("/notes");
  redirect(`/notes/${noteId}`);
}

export async function updateNoteAction(id: string, data: NoteUpdate) {
  const fs = await getFS();

  const content = data.content || " ";

  const metadata: Omit<NoteMetadata, "path" | "created_at" | "updated_at"> = {
    type: "note",
    title: data.title ?? "",
  };
  await fs.write(`${PATHS.NOTES}/${id}.md`, content, metadata);

  revalidatePath("/notes");
}

export async function deleteNoteAction(id: string, isActive: boolean) {
  const fs = await getFS();

  await fs.delete(`${PATHS.NOTES}/${id}.md`);

  revalidatePath("/notes");
  if (isActive) {
    redirect("/notes");
  }
}

export async function getNoteAction(id: string): Promise<Note | null> {
  const fs = await getFS();

  try {
    const result = await fs.read(`${PATHS.NOTES}/${id}.md`);

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
  } catch {
    return null;
  }
}
