"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils/ui";
import { updateNoteAction } from "../../actions/notes";
import type { Note } from "../../types";

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [content, setContent] = useState(
    note.content === " " ? "" : note.content || "",
  );
  const [title, setTitle] = useState(note.title || "");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount to auto-focus when note is empty; reads initial `content` value intentionally.
  useEffect(() => {
    if (!content) {
      textareaRef.current?.focus();
    }
  }, []);

  const saveNote = useCallback(
    async (newTitle: string, newContent: string) => {
      setSaving(true);
      try {
        await updateNoteAction(note.id, {
          title: newTitle,
          content: newContent,
        });
      } catch (e) {
        console.error("Failed to save note", e);
      } finally {
        setSaving(false);
      }
    },
    [note.id],
  );

  const autoSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(newTitle, newContent);
      }, 1000);
    },
    [saveNote],
  );

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    autoSave(title, newContent);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    autoSave(newTitle, content);
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Title and toolbar */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        {/* Back button on mobile */}
        <Link href="/notes" className="md:hidden p-1 -ml-1 text-muted">
          <ArrowLeftIcon size={20} />
        </Link>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
          className="text-base md:text-lg font-medium bg-transparent outline-none flex-1 min-w-0 text-foreground"
        />
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {saving && <span className="text-xs text-muted">saving...</span>}
          {/* Toggle preview on mobile */}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={cn(
              "md:hidden text-xs px-2 py-1 rounded",
              showPreview ? "bg-accent text-white" : "bg-surface text-muted",
            )}
          >
            {showPreview ? "edit" : "preview"}
          </button>
          <span className="hidden md:inline text-xs text-muted">markdown</span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor - hidden on mobile when preview is shown */}
        <div
          className={cn(
            showPreview ? "hidden" : "flex",
            "md:flex flex-1 overflow-hidden md:border-r border-border",
          )}
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
          className={cn(
            showPreview ? "flex" : "hidden",
            "md:flex flex-1 overflow-y-auto p-4 md:p-6 bg-surface",
          )}
        >
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>
              {content || "*Start typing to see preview...*"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
