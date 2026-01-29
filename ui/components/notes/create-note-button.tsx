"use client";

import { useTransition } from "react";
import { createNoteAction } from "@/actions/notes";

export function CreateNoteButton() {
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      await createNoteAction({ title: "Untitled", content: "" });
    });
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isPending}
      className="text-sm transition-colors hover:opacity-70 text-accent disabled:opacity-50"
    >
      + create note
    </button>
  );
}
