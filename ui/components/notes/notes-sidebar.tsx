"use client";

import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/utils/ui";
import type { Note } from "@/types";
import { createNoteAction, deleteNoteAction } from "@/actions/notes";
import { formatTimeAgo } from "@/lib/utils/format";

interface NotesSidebarProps {
  initialNotes: Note[];
}

export function NotesSidebar({ initialNotes }: NotesSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreating, startCreateTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();
  const [optimisticNotes, setOptimisticNotes] = useOptimistic(
    initialNotes,
    (state: Note[], action: { type: "delete"; id: string }) =>
      state.filter((note) => note.id !== action.id),
  );

  const isNoteActive = (noteId: string) => pathname === `/notes/${noteId}`;
  const isOnDetail = pathname !== "/notes";

  const handleCreate = () => {
    startCreateTransition(async () => {
      await createNoteAction({ title: "Untitled", content: "" });
    });
  };

  const handleDelete = (noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const active = isNoteActive(noteId);
    if (active) router.push("/notes");
    startDeleteTransition(async () => {
      setOptimisticNotes({ type: "delete", id: noteId });
      try {
        await deleteNoteAction(noteId);
      } catch {
        alert("Failed to delete note.");
      }
    });
  };

  return (
    <div
      className={cn(
        isOnDetail ? "hidden md:flex" : "flex",
        "w-full md:w-64 border-b md:border-b-0 md:border-r border-border flex-col",
      )}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Notes</h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className="text-xs transition-colors hover:opacity-70 text-accent disabled:opacity-50"
        >
          + new
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {optimisticNotes.length === 0 ? (
          <p className="text-xs p-2 text-muted">no notes yet</p>
        ) : (
          <ul className="space-y-0.5">
            {optimisticNotes.map((note) => (
              <li key={note.id} className="group/item relative">
                <Link
                  href={`/notes/${note.id}`}
                  className={cn(
                    "block w-full text-left px-3 py-2 pr-8 text-xs rounded-lg transition-colors",
                    isNoteActive(note.id)
                      ? "bg-surface-hover text-foreground"
                      : "text-muted",
                  )}
                >
                  <div className="truncate">{note.title || "Untitled"}</div>
                  <div className="text-[10px] mt-0.5 text-muted">
                    {formatTimeAgo(note.updated_at || "")}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => handleDelete(note.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity hover:opacity-70 text-accent"
                  title="Delete"
                >
                  <TrashIcon size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
