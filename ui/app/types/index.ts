// Shared types for the Bernd application

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
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
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "text_delta"; delta: string }
  | { type: "response_end"; content: string }
  | { type: "chat_saved"; chat_id: string };
