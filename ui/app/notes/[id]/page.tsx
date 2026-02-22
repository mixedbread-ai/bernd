import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import { getFS } from "@/lib/context";
import { getNote } from "@/lib/data/notes";

export default async function NoteDetailPage({
  params,
}: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const fs = await getFS();
  const note = await getNote(fs, id);

  if (!note) {
    notFound();
  }

  return <NoteEditor note={note} />;
}
