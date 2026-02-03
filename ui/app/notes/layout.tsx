import { NotesSidebar } from "@/components/notes/notes-sidebar";
import { getFS } from "@/lib/context";
import { getNotes } from "@/lib/data/notes";

export default async function NotesLayout({ children }: LayoutProps<"/notes">) {
  const fs = await getFS();
  const notes = await getNotes(fs);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <NotesSidebar initialNotes={notes} />
      {children}
    </div>
  );
}
