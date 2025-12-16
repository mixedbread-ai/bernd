"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Note } from "../types";
import { API_ENDPOINTS } from "../config";
import { api } from "../lib/api";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.notes);
      const data = await res.json();
      setNotes(data);
    } catch (e) {
      console.error("Failed to fetch notes", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const loadNote = async (note: Note) => {
    try {
      const res = await api.get(API_ENDPOINTS.noteById(note.id));
      const data = await res.json();
      if (data.error) {
        console.error("Note not found");
        return;
      }
      setSelectedNote(data);
      setContent(data.content || "");
      setTitle(data.title || "");
    } catch (e) {
      console.error("Failed to load note", e);
    }
  };

  const saveNote = useCallback(async (noteId: string, newTitle: string, newContent: string) => {
    setSaving(true);
    try {
      await api.put(API_ENDPOINTS.noteById(noteId), { title: newTitle, content: newContent });
      fetchNotes();
    } catch (e) {
      console.error("Failed to save note", e);
    } finally {
      setSaving(false);
    }
  }, [fetchNotes]);

  const autoSave = useCallback((noteId: string, newTitle: string, newContent: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(noteId, newTitle, newContent);
    }, 1000);
  }, [saveNote]);

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

  const createNote = async () => {
    try {
      const res = await api.post(API_ENDPOINTS.notes, { title: "Untitled", content: "" });
      const data = await res.json();
      await fetchNotes();
      setSelectedNote(data);
      setContent(data.content || "");
      setTitle(data.title || "");
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (e) {
      console.error("Failed to create note", e);
    }
  };

  const deleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(API_ENDPOINTS.noteById(noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setContent("");
        setTitle("");
      }
      fetchNotes();
    } catch (e) {
      console.error("Failed to delete note", e);
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Notes list sidebar */}
      <div
        className="w-64 border-r flex flex-col"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Notes</h2>
          <button
            onClick={createNote}
            className="text-xs transition-colors hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            + new
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-xs p-2" style={{ color: 'var(--muted)' }}>loading...</p>
          ) : notes.length === 0 ? (
            <p className="text-xs p-2" style={{ color: 'var(--muted)' }}>no notes yet</p>
          ) : (
            <ul className="space-y-0.5">
              {notes.map((note) => (
                <li key={note.id} className="group/item relative">
                  <button
                    onClick={() => loadNote(note)}
                    className="w-full text-left px-3 py-2 pr-8 text-xs rounded-lg transition-colors"
                    style={{
                      background: selectedNote?.id === note.id ? 'var(--surface-hover)' : 'transparent',
                      color: selectedNote?.id === note.id ? 'var(--foreground)' : 'var(--muted)',
                    }}
                  >
                    <div className="truncate">{note.title || "Untitled"}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {formatDate(note.updated_at || "")}
                    </div>
                  </button>
                  <button
                    onClick={(e) => deleteNote(note.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--accent)' }}
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Title and toolbar */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Note title..."
                className="text-lg font-medium bg-transparent outline-none flex-1"
                style={{ color: 'var(--foreground)' }}
              />
              <div className="flex items-center gap-4">
                {saving && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>saving...</span>
                )}
                <span className="text-xs" style={{ color: 'var(--muted)' }}>markdown</span>
              </div>
            </div>

            {/* Content area - split view */}
            <div className="flex-1 flex overflow-hidden">
              {/* Editor */}
              <div className="flex-1 overflow-hidden border-r" style={{ borderColor: 'var(--border)' }}>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Write your notes in markdown..."
                  className="w-full h-full p-6 bg-transparent outline-none resize-none text-sm font-mono"
                  style={{ color: 'var(--foreground)' }}
                />
              </div>
              {/* Live preview */}
              <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface)' }}>
                <div className="prose prose-sm max-w-none" style={{ color: 'var(--foreground)' }}>
                  <ReactMarkdown>{content || "*Start typing to see preview...*"}</ReactMarkdown>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Select a note or create a new one</p>
              <button
                onClick={createNote}
                className="text-sm transition-colors hover:opacity-70"
                style={{ color: 'var(--accent)' }}
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
