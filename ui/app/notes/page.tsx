import { NotesClient } from "@/components/notes-client";
import { getFS } from "@/lib/context";
import { getNotes } from "@/lib/data/notes";

export default async function NotesPage() {
  const fs = await getFS();
  const notes = await getNotes(fs);

  return <NotesClient initialNotes={notes} />;
}
