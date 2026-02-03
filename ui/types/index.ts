import type { Priority, TodoStatus } from "@/lib/constants";

interface BaseMetadata {
  path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TodoMetadata extends BaseMetadata {
  type: "todo";
  title?: string;
  status?: TodoStatus;
  priority?: Priority;
  due_date?: string;
  tags?: string[];
  calendar_event_id?: string;
}

export interface NoteMetadata extends BaseMetadata {
  type: "note";
  title: string;
}

export interface ChatMetadata extends BaseMetadata {
  type: "chat";
  title: string;
  message_count: number;
}

export interface AuthMetadata extends BaseMetadata {
  type: "auth";
  provider?: "google";
}

export interface MemoryMetadata extends BaseMetadata {
  type: "memory";
}

export interface FileUploadMetadata extends BaseMetadata {
  type: "file";
  mime_type: string;
  size: number;
  is_base64: boolean;
  original_name: string;
}

export interface FolderMarkerMetadata extends BaseMetadata {
  type: "folder_marker";
}

export interface BinaryMetadata extends BaseMetadata {
  type: "binary";
}

export interface ToolMetadata extends BaseMetadata {
  type: "tool";
}

export type FileMetadata =
  | TodoMetadata
  | NoteMetadata
  | ChatMetadata
  | AuthMetadata
  | MemoryMetadata
  | FileUploadMetadata
  | FolderMarkerMetadata
  | BinaryMetadata
  | ToolMetadata;

export function isTodoMetadata(m: FileMetadata): m is TodoMetadata {
  return m.type === "todo";
}

export function isNoteMetadata(m: FileMetadata): m is NoteMetadata {
  return m.type === "note";
}

export function isChatMetadata(m: FileMetadata): m is ChatMetadata {
  return m.type === "chat";
}

export function isAuthMetadata(m: FileMetadata): m is AuthMetadata {
  return m.type === "auth";
}

export function isFileUploadMetadata(m: FileMetadata): m is FileUploadMetadata {
  return m.type === "file";
}

export function isFolderMarkerMetadata(
  m: FileMetadata,
): m is FolderMarkerMetadata {
  return m.type === "folder_marker";
}

export function isBinaryMetadata(m: FileMetadata): m is BinaryMetadata {
  return m.type === "binary";
}

export function isMemoryMetadata(m: FileMetadata): m is MemoryMetadata {
  return m.type === "memory";
}

export function isToolMetadata(m: FileMetadata): m is ToolMetadata {
  return m.type === "tool";
}

export interface ImageAttachment {
  type: "image";
  data: string; // base64 data URL
  mimeType: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
}

export interface ChatSummary {
  id: string;
  title: string;
  message_count: number;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  tags?: string[];
  calendar_event_id?: string;
  created_at?: string;
}

export interface SearchResult {
  path: string;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface Note {
  id: string;
  title: string;
  content?: string;
  updated_at?: string;
}

export type StreamEvent =
  | {
      type: "tool_call";
      name: string;
      args: Record<string, unknown>;
      call_id: string;
    }
  | { type: "tool_result"; call_id: string; result: unknown }
  | { type: "text_delta"; delta: string }
  | { type: "response_end"; content: string }
  | { type: "chat_saved"; chat_id: string };

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mime_type?: string;
  created_at?: string;
}
