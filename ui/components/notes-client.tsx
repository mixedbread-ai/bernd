"use client";

import { ArrowLeftIcon, TrashIcon } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
  createNote,
  deleteNote,
  getNoteAction,
  updateNote,
} from "../actions/notes";
import { formatTimeAgo } from "../lib/utils/format";
import type { Note } from "../types";

interface NotesClientProps {
  initialNotes: Note[];
}

export function NotesClient({ initialNotes }: NotesClientProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();

  const loadNote = async (note: Note) => {
    try {
      const fullNote = await getNoteAction(note.id);
      if (!fullNote) {
        console.error("Note not found");
        return;
      }
      setSelectedNote(fullNote);
      setContent(fullNote.content || "");
      setTitle(fullNote.title || "");
    } catch (e) {
      console.error("Failed to load note", e);
    }
  };

  const saveNote = useCallback(
    async (noteId: string, newTitle: string, newContent: string) => {
      setSaving(true);
      try {
        await updateNote(noteId, { title: newTitle, content: newContent });
        // Update local state
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  id: newTitle,
                  title: newTitle,
                  updated_at: new Date().toISOString(),
                }
              : n,
          ),
        );
        if (selectedNote?.id === noteId && newTitle !== noteId) {
          setSelectedNote((prev) =>
            prev ? { ...prev, id: newTitle, title: newTitle } : null,
          );
        }
      } catch (e) {
        console.error("Failed to save note", e);
      } finally {
        setSaving(false);
      }
    },
    [selectedNote],
  );

  const autoSave = useCallback(
    (noteId: string, newTitle: string, newContent: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(noteId, newTitle, newContent);
      }, 1000);
    },
    [saveNote],
  );

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (selectedNote) {
      autoSave(selectedNote.id, title, newContent);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (selectedNote) {
      autoSave(selectedNote.id, newTitle, content);
    }
  };

  const handleCreateNote = () => {
    startTransition(async () => {
      try {
        const newTitle = "Untitled";
        await createNote({ title: newTitle, content: "" });
        const newNote: Note = {
          id: newTitle,
          title: newTitle,
          content: "",
          updated_at: new Date().toISOString(),
        };
        setNotes((prev) => [newNote, ...prev]);
        setSelectedNote(newNote);
        setContent("");
        setTitle(newTitle);
        setTimeout(() => textareaRef.current?.focus(), 100);
      } catch (e) {
        console.error("Failed to create note", e);
      }
    });
  };

  const handleDeleteNote = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        await deleteNote(noteId);
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
          setContent("");
          setTitle("");
        }
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      } catch (e) {
        console.error("Failed to delete note", e);
      }
    });
  };

  const goBack = () => {
    setSelectedNote(null);
    setContent("");
    setTitle("");
  };

  // Mobile: Show note list or editor, not both
  // Desktop: Show both side by side
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Notes list sidebar - hidden on mobile when note is selected */}
      <div
        className={`${selectedNote ? "hidden md:flex" : "flex"} w-full md:w-64 border-b md:border-b-0 md:border-r border-border flex-col`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Notes</h2>
          <button
            type="button"
            onClick={handleCreateNote}
            disabled={isPending}
            className="text-xs transition-colors hover:opacity-70 text-accent disabled:opacity-50"
          >
            + new
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <p className="text-xs p-2 text-muted">no notes yet</p>
          ) : (
            <ul className="space-y-0.5">
              {notes.map((note) => (
                <li key={note.id} className="group/item relative">
                  <button
                    type="button"
                    onClick={() => loadNote(note)}
                    className={`w-full text-left px-3 py-2 pr-8 text-xs rounded-lg transition-colors ${
                      selectedNote?.id === note.id
                        ? "bg-surface-hover text-foreground"
                        : "text-muted"
                    }`}
                  >
                    <div className="truncate">{note.title || "Untitled"}</div>
                    <div className="text-[10px] mt-0.5 text-muted">
                      {formatTimeAgo(note.updated_at || "")}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNote(note.id, e)}
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

      {/* Editor area - full screen on mobile when note is selected */}
      <div
        className={`${selectedNote ? "flex" : "hidden md:flex"} flex-1 flex-col`}
      >
        {selectedNote ? (
          <>
            {/* Title and toolbar */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              {/* Back button on mobile */}
              <button
                type="button"
                onClick={goBack}
                className="md:hidden p-1 -ml-1 text-muted"
              >
                <ArrowLeftIcon size={20} />
              </button>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Note title..."
                className="text-base md:text-lg font-medium bg-transparent outline-none flex-1 min-w-0 text-foreground"
              />
              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                {saving && (
                  <span className="text-xs text-muted">saving...</span>
                )}
                {/* Toggle preview on mobile */}
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`md:hidden text-xs px-2 py-1 rounded ${showPreview ? "bg-accent text-white" : "bg-surface text-muted"}`}
                >
                  {showPreview ? "edit" : "preview"}
                </button>
                <span className="hidden md:inline text-xs text-muted">
                  markdown
                </span>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Editor - hidden on mobile when preview is shown */}
              <div
                className={`${showPreview ? "hidden" : "flex"} md:flex flex-1 overflow-hidden md:border-r border-border`}
              >
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Write your notes in markdown..."
                  className="w-full h-full p-4 md:p-6 bg-transparent outline-none resize-none text-sm font-mono text-foreground"
                />
              </div>
              {/* Live preview - shown on mobile when preview is toggled, always on desktop */}
              <div
                className={`${showPreview ? "flex" : "hidden"} md:flex flex-1 overflow-y-auto p-4 md:p-6 bg-surface`}
              >
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>
                    {content || "*Start typing to see preview...*"}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm mb-2 text-muted">
                Select a note or create a new one
              </p>
              <button
                type="button"
                onClick={handleCreateNote}
                disabled={isPending}
                className="text-sm transition-colors hover:opacity-70 text-accent disabled:opacity-50"
              >
                + create note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
