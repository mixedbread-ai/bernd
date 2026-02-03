import { PATHS } from "@/lib/constants";
import type { FileListItem, SemanticFS } from "@/lib/services/semantic-fs";
import {
  type ChatMetadata,
  type ChatSummary,
  isChatMetadata,
  type Message,
} from "@/types";

function pathToId(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(".json", "");
}

function fileToChatSummary(file: FileListItem): ChatSummary {
  const metadata = file.metadata;
  if (isChatMetadata(metadata)) {
    return {
      id: pathToId(file.path),
      title: metadata.title,
      message_count: metadata.message_count,
    };
  }
  throw new Error(`Expected chat metadata, got ${metadata.type}`);
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
  try {
    const result = await fs.read(`${PATHS.CHATS}/${id}.json`);

    // Messages stored as array, title in metadata (Python backend format)
    const messages = JSON.parse(result.content);
    const title = isChatMetadata(result.metadata)
      ? result.metadata.title
      : "Untitled Chat";

    return {
      id,
      title,
      messages,
      created_at: result.metadata.created_at ?? undefined,
      updated_at: result.metadata.updated_at ?? undefined,
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
  // Save messages as array, title in metadata (Python backend format)
  const content = JSON.stringify(messages);
  const metadata: Omit<ChatMetadata, "path" | "created_at" | "updated_at"> = {
    type: "chat",
    title,
    message_count: messages.length,
  };
  return fs.write(`${PATHS.CHATS}/${id}.json`, content, metadata);
}
