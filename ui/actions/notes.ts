"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import { generateTimestamp } from "@/lib/utils";
import type { NoteCreate, NoteMetadata, NoteUpdate } from "@/types";

function generateNoteId(): string {
  const ts = generateTimestamp();
  return `${ts.slice(0, 8)}_${ts.slice(8)}`;
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

  // Read existing note to preserve fields not included in the partial update
  let existingTitle = "";
  let existingContent = " ";
  try {
    const existing = await fs.read(`${PATHS.NOTES}/${id}.md`);
    existingTitle = (existing.metadata?.title as string) ?? "";
    existingContent = existing.content || " ";
  } catch {
    // Note doesn't exist yet
  }

  const content = data.content ?? existingContent;

  const metadata: Omit<NoteMetadata, "path" | "created_at" | "updated_at"> = {
    type: "note",
    title: data.title ?? existingTitle,
  };
  await fs.write(`${PATHS.NOTES}/${id}.md`, content, metadata);

  revalidatePath("/notes");
}

export async function deleteNoteAction(id: string) {
  const fs = await getFS();

  await fs.delete(`${PATHS.NOTES}/${id}.md`);

  revalidatePath("/notes");
}
