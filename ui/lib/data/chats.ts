import { PATHS } from "@/lib/constants";
import type { FileListItem, SemanticFS } from "@/lib/services/semantic-fs";
import { pathToId } from "@/lib/utils";
import {
  type Chat,
  type ChatMetadata,
  type ChatSummary,
  type ImageAttachment,
  isChatMetadata,
  type Message,
} from "@/types";

const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

async function saveImageToStore(
  fs: SemanticFS,
  chatId: string,
  imageData: string,
  mimeType: string,
): Promise<string> {
  const ext = EXT_MAP[mimeType] ?? "png";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${PATHS.CHAT_ASSETS}/${chatId}/${filename}`;

  // Strip data URL prefix if present
  const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;

  const buffer = Buffer.from(base64, "base64");
  await fs.writeBinary(
    path,
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
    mimeType,
  );

  return path;
}

async function extractImage(
  fs: SemanticFS,
  chatId: string,
  img: ImageAttachment,
): Promise<ImageAttachment> {
  if (!img.data?.startsWith("data:")) return img;

  const path = await saveImageToStore(fs, chatId, img.data, img.mimeType);
  return { type: "image", data: path, mimeType: img.mimeType };
}

export async function processImagesForSave(
  fs: SemanticFS,
  chatId: string,
  messages: Message[],
): Promise<Message[]> {
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.images?.length) return { role: msg.role, content: msg.content };

      const images = await Promise.all(
        msg.images.map((img) => extractImage(fs, chatId, img)),
      );
      return { role: msg.role, content: msg.content, images };
    }),
  );
}

function fileToChatSummary(file: FileListItem): ChatSummary {
  const metadata = file.metadata;
  if (isChatMetadata(metadata)) {
    return {
      id: pathToId(file.path, ".json"),
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

export async function getChat(
  fs: SemanticFS,
  id: string,
): Promise<Chat | null> {
  try {
    const result = await fs.read(`${PATHS.CHATS}/${id}.json`);

    // Messages stored as array, title in metadata (Python backend format)
    const messages: Message[] = JSON.parse(result.content);
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
