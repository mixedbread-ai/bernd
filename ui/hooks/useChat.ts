"use client";

import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ImageAttachment, Message, ToolCall } from "../types";

interface UseChatOptions {
  chatId?: string | null;
  onChatSaved?: (chatId: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  input: string;
  setInput: (value: string) => void;
  images: ImageAttachment[];
  addImage: (image: ImageAttachment) => void;
  removeImage: (index: number) => void;
  clearImages: () => void;
  loading: boolean;
  streamingToolCalls: ToolCall[];
  streamingContent: string;
  sendMessage: (chatId?: string | null) => Promise<void>;
  clearChat: () => void;
}

// Helper to extract text and tool calls from message parts
function extractFromParts(parts: unknown[]): {
  text: string;
  toolCalls: ToolCall[];
} {
  let text = "";
  const toolCalls: ToolCall[] = [];

  for (const part of parts) {
    if (typeof part !== "object" || part === null) continue;
    const p = part as Record<string, unknown>;

    if (p.type === "text" && typeof p.text === "string") {
      text += p.text;
    } else if (typeof p.type === "string" && p.type.startsWith("tool-")) {
      // New AI SDK 6 tool format
      const toolName = p.type.slice(5); // Remove "tool-" prefix
      toolCalls.push({
        name: toolName,
        args: (p.input as Record<string, unknown>) ?? {},
        call_id: (p.toolCallId as string) ?? "",
        result: p.output !== undefined ? p.output : undefined,
      });
    }
  }

  return { text, toolCalls };
}

// Convert AI SDK message to our Message format
function convertToMessage(msg: unknown): Message {
  const m = msg as { id?: string; role: string; parts?: unknown[] };
  const { text, toolCalls } = extractFromParts(m.parts ?? []);

  return {
    role: m.role as "user" | "assistant",
    content: text,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    options.chatId ?? null,
  );
  const [localInput, setLocalInput] = useState("");

  // Use ref to track chatId so transport always has current value
  const chatIdRef = useRef<string | null>(currentChatId);
  chatIdRef.current = currentChatId;

  const {
    messages: aiMessages,
    status,
    sendMessage: aiSendMessage,
    setMessages: aiSetMessages,
  } = useAIChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        chatId: chatIdRef.current,
      }),
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Extract streaming state from the last message if it's being generated
  const { streamingContent, streamingToolCalls } = useMemo(() => {
    if (!isStreaming) {
      return { streamingContent: "", streamingToolCalls: [] };
    }

    const lastMessage = aiMessages[aiMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") {
      return { streamingContent: "", streamingToolCalls: [] };
    }

    const { text, toolCalls } = extractFromParts(lastMessage.parts ?? []);
    return { streamingContent: text, streamingToolCalls: toolCalls };
  }, [aiMessages, isStreaming]);

  // Convert AI SDK messages to our format
  // Exclude the last message when streaming (it's shown via StreamingMessage)
  const messages = useMemo(() => {
    const messagesToConvert =
      isStreaming &&
      aiMessages.length > 0 &&
      aiMessages[aiMessages.length - 1].role === "assistant"
        ? aiMessages.slice(0, -1)
        : aiMessages;
    return messagesToConvert.map(convertToMessage);
  }, [aiMessages, isStreaming]);

  const loading = isStreaming;

  const addImage = useCallback((image: ImageAttachment) => {
    setImages((prev) => [...prev, image]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  const clearChat = useCallback(() => {
    aiSetMessages([]);
    setImages([]);
    setCurrentChatId(null);
    chatIdRef.current = null;
    setLocalInput("");
  }, [aiSetMessages]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setMessages = useCallback((_: Message[]) => {
    // For now, we don't support setting messages directly
    // This would require converting back to AI SDK format which is complex
    console.warn("setMessages is not fully supported in the new useChat hook");
  }, []);

  const sendMessage = useCallback(
    async (chatId?: string | null) => {
      if ((!localInput.trim() && images.length === 0) || loading) return;

      // Generate a new chat ID if we don't have one
      const effectiveChatId =
        chatId ?? chatIdRef.current ?? `chat-${Date.now()}`;

      // Update ref immediately (sync) so transport has correct value
      chatIdRef.current = effectiveChatId;

      // Update state for React
      if (chatId !== undefined || !currentChatId) {
        setCurrentChatId(effectiveChatId);
        if (!currentChatId) {
          options.onChatSaved?.(effectiveChatId);
        }
      }

      // Send message
      await aiSendMessage({ text: localInput.trim() });
      setLocalInput("");
      setImages([]);
    },
    [localInput, images, loading, currentChatId, aiSendMessage, options],
  );

  return {
    messages,
    setMessages,
    input: localInput,
    setInput: setLocalInput,
    images,
    addImage,
    removeImage,
    clearImages,
    loading,
    streamingToolCalls,
    streamingContent,
    sendMessage,
    clearChat,
  };
}

// Utility for handling Enter key in textarea
export function handleChatKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  input: string,
  setInput: (value: string) => void,
  sendMessage: () => void,
) {
  if (e.key === "Enter") {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      // Cmd+Enter, Ctrl+Enter, or Shift+Enter = new line
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = `${input.slice(0, start)}\n${input.slice(end)}`;
      setInput(newValue);
      // Set cursor position after the newline
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
      return;
    }
    // Plain Enter = send
    e.preventDefault();
    sendMessage();
  }
}

// Utility for converting File to ImageAttachment
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

// Utility for handling paste events with images
export async function handlePasteWithImages(
  e: React.ClipboardEvent,
  addImage: (image: ImageAttachment) => void,
): Promise<boolean> {
  const items = e.clipboardData?.items;
  if (!items) return false;

  let hasImage = false;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        const attachment = await fileToImageAttachment(file);
        if (attachment) {
          addImage(attachment);
          hasImage = true;
        }
      }
    }
  }
  return hasImage;
}
