import { CreateNoteButton } from "@/components/notes/create-note-button";

export default function NotesPage() {
  return (
    <div className="hidden md:flex flex-1 items-center justify-center">
      <div className="text-center">
        <p className="text-sm mb-2 text-muted">
          Select a note or create a new one
        </p>
        <CreateNoteButton />
      </div>
    </div>
  );
}
