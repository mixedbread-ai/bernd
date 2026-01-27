"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import type { Note } from "@/types";

export interface NoteCreate {
	title: string;
	content?: string;
}

export interface NoteUpdate {
	title?: string;
	content?: string;
}

export async function createNote(
	data: NoteCreate,
): Promise<{ status: string; path: string }> {
	const fs = await getFS();

	const content = data.content ?? "";
	const result = await fs.write(`${PATHS.NOTES}/${data.title}.md`, content, {
		type: "note",
	});

	revalidatePath("/notes");
	return result;
}

export async function updateNote(
	id: string,
	data: NoteUpdate,
): Promise<{ status: string; path: string }> {
	const fs = await getFS();

	const newTitle = data.title ?? id;
	const content = data.content ?? "";

	// Delete old file if title changed
	if (newTitle !== id) {
		await fs.delete(`${PATHS.NOTES}/${id}.md`);
	}

	const result = await fs.write(`${PATHS.NOTES}/${newTitle}.md`, content, {
		type: "note",
	});

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

	return {
		id,
		title: id,
		content: result.content,
		updated_at: (result.metadata.updated_at as string) ?? undefined,
	};
}
