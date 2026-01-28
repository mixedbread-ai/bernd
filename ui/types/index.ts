// Shared types for the Bernd application

import type { Priority, TodoStatus } from "@/lib/constants";

// ============================================================================
// File Metadata Types (Discriminated Union)
// ============================================================================

// Base fields auto-set by SemanticFS.write()
interface BaseMetadata {
  path?: string;
  created_at?: string;
  updated_at?: string;
}

// Todo metadata (/todos/*.md)
export interface TodoMetadata extends BaseMetadata {
  type: "todo";
  title?: string;
  status?: TodoStatus;
  priority?: Priority;
  due_date?: string;
  tags?: string[];
  calendar_event_id?: string;
}

// Note metadata (/notes/*.md)
export interface NoteMetadata extends BaseMetadata {
  type: "note";
  title: string;
}

// Chat metadata (/chats/*.json)
export interface ChatMetadata extends BaseMetadata {
  type: "chat";
  title: string;
  message_count: number;
}

// Auth metadata (/auth/*.json)
export interface AuthMetadata extends BaseMetadata {
  type: "auth";
  provider?: "google";
}

// Memory metadata (/memories/*)
export interface MemoryMetadata extends BaseMetadata {
  type: "memory";
}

// File upload metadata (/files/*)
export interface FileUploadMetadata extends BaseMetadata {
  type: "file";
  mime_type: string;
  size: number;
  is_base64: boolean;
  original_name: string;
}

// Folder marker metadata
export interface FolderMarkerMetadata extends BaseMetadata {
  type: "folder_marker";
}

// Binary metadata (/chat_assets/**)
export interface BinaryMetadata extends BaseMetadata {
  type: "binary";
}

// Tool metadata (/tools/*.md)
export interface ToolMetadata extends BaseMetadata {
  type: "tool";
}

// Discriminated union of all metadata types
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

// Type guards
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

// ============================================================================
// Application Types
// ============================================================================

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  call_id?: string;
  result?: unknown;
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
  toolCalls?: ToolCall[];
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

// SSE event types from the streaming API
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
