// Pure functions for fetching chats data

import type { ChatSummary, Message } from "@/types";
import { PATHS } from "../constants";
import type { FileListItem, SemanticFS } from "../services/semantic-fs";

function pathToId(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(".json", "");
}

function fileToChatSummary(file: FileListItem): ChatSummary {
  const metadata = file.metadata;
  return {
    id: pathToId(file.path),
    title: (metadata.title as string) ?? "Untitled Chat",
    message_count: (metadata.message_count as number) ?? 0,
  };
}

export async function getChats(
  fs: SemanticFS,
  limit = 50,
): Promise<ChatSummary[]> {
  const files = await fs.list(PATHS.CHATS, limit);
  return files
    .filter((f) => f.path.endsWith(".json"))
    .map(fileToChatSummary)
    .sort((a, b) => b.id.localeCompare(a.id)); // Sort by ID descending (newest first)
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
}

export async function getChat(
  fs: SemanticFS,
  id: string,
): Promise<Chat | null> {
  const result = await fs.read(`${PATHS.CHATS}/${id}.json`);
  if ("error" in result) {
    return null;
  }

  try {
    const data = JSON.parse(result.content);
    return {
      id,
      title: data.title ?? "Untitled Chat",
      messages: data.messages ?? [],
      created_at: (result.metadata.created_at as string) ?? undefined,
      updated_at: (result.metadata.updated_at as string) ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function saveChat(
  fs: SemanticFS,
  id: string,
  title: string,
  messages: Message[],
): Promise<{ status: string; path: string }> {
  const content = JSON.stringify({ title, messages }, null, 2);
  return fs.write(`${PATHS.CHATS}/${id}.json`, content, {
    type: "chat",
    title,
    message_count: messages.length,
  });
}
