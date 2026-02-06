import type { UIMessage } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import type { ImageAttachment, Message } from "@/types";

export function handleChatKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  input: string,
  setInput: (value: string) => void,
  sendMessage: () => void,
) {
  if (e.key === "Enter") {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = `${input.slice(0, start)}\n${input.slice(end)}`;
      setInput(newValue);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
      return;
    }
    e.preventDefault();
    sendMessage();
  }
}

export async function fileToImageAttachment(
  file: File,
): Promise<ImageAttachment | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        type: "image",
        data: reader.result as string,
        mimeType: file.type,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function handlePasteWithImages(
  e: React.ClipboardEvent,
  addImage: (image: ImageAttachment) => void,
): Promise<boolean> {
  const items = e.clipboardData?.items;
  if (!items) return false;

  const hasImage = Array.from(items).some((item) =>
    item.type.startsWith("image/"),
  );

  if (hasImage) {
    e.preventDefault();
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const attachment = await fileToImageAttachment(file);
          if (attachment) {
            addImage(attachment);
          }
        }
      }
    }
  }
  return hasImage;
}

export function imagesToFileParts(images: ImageAttachment[]): FileUIPart[] {
  return images.map((img) => ({
    type: "file",
    mediaType: img.mimeType,
    url: img.data,
  }));
}

export function storedMessagesToUIMessages(messages: Message[]): UIMessage[] {
  return messages.map((message, index) => {
    const parts: UIMessage["parts"] = [];

    // Restore image parts before text
    if (message.images) {
      for (const img of message.images) {
        parts.push({
          type: "file",
          mediaType: img.mimeType,
          url: img.data,
        });
      }
    }

    if (message.content) {
      parts.push({ type: "text", text: message.content });
    }

    return {
      id: `message-${index}`,
      role: message.role,
      parts,
    };
  });
}
