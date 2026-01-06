"use client";

import { useState, useCallback } from "react";
import { Message, ToolCall, StreamEvent, ImageAttachment } from "../types";
import { API_ENDPOINTS } from "../config";
import { api } from "../lib/api";

interface UseChatOptions {
  onChatSaved?: (chatId: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
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

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingContent, setStreamingContent] = useState("");

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
    setMessages([]);
    setStreamingContent("");
    setStreamingToolCalls([]);
    setImages([]);
  }, []);

  const sendMessage = useCallback(
    async (chatId?: string | null) => {
      if ((!input.trim() && images.length === 0) || loading) return;

      const userMessage: Message = {
        role: "user",
        content: input.trim(),
        images: images.length > 0 ? [...images] : undefined,
      };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setImages([]);
      setLoading(true);
      setStreamingToolCalls([]);
      setStreamingContent("");

      try {
        const res = await api.post(API_ENDPOINTS.chatStream, { messages: newMessages, chat_id: chatId });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        const toolCalls: ToolCall[] = [];
        let finalContent = "";
        let buffer = ""; // Buffer for incomplete SSE lines

        const processEvent = (data: StreamEvent) => {
          if (data.type === "tool_call") {
            toolCalls.push({ name: data.name, args: data.args, call_id: data.call_id });
            setStreamingToolCalls([...toolCalls]);
          } else if (data.type === "tool_result") {
            // Find and update the matching tool call with its result
            let idx = toolCalls.findIndex(tc => tc.call_id === data.call_id);
            // Fallback: if no match by call_id, find first tool call without a result
            if (idx === -1) {
              idx = toolCalls.findIndex(tc => tc.result === undefined);
            }
            if (idx !== -1) {
              toolCalls[idx] = { ...toolCalls[idx], result: data.result };
              setStreamingToolCalls([...toolCalls]);
            }
          } else if (data.type === "text_delta") {
            // If we're getting text, all tool calls are done - mark any without results as complete
            let hasUnfinished = false;
            for (let i = 0; i < toolCalls.length; i++) {
              if (toolCalls[i].result === undefined) {
                toolCalls[i] = { ...toolCalls[i], result: { status: "completed" } };
                hasUnfinished = true;
              }
            }
            if (hasUnfinished) {
              setStreamingToolCalls([...toolCalls]);
            }
            finalContent += data.delta;
            setStreamingContent(finalContent);
          } else if (data.type === "response_end") {
            finalContent = data.content;
            setStreamingContent(finalContent);
          } else if (data.type === "chat_saved") {
            options.onChatSaved?.(data.chat_id);
          }
        };

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Append new chunk to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (ending with \n\n for SSE)
            const parts = buffer.split("\n");

            // Keep the last part in buffer (might be incomplete)
            buffer = parts.pop() || "";

            for (const line of parts) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as StreamEvent;
                  processEvent(data);
                } catch {
                  // ignore parse errors
                }
              }
            }
          }

          // Process any remaining buffer after stream ends
          if (buffer.startsWith("data: ")) {
            try {
              const data = JSON.parse(buffer.slice(6)) as StreamEvent;
              processEvent(data);
            } catch {
              // ignore
            }
          }
        }

        setMessages([
          ...newMessages,
          { role: "assistant", content: finalContent, toolCalls },
        ]);
        setStreamingToolCalls([]);
        setStreamingContent("");
      } catch (e) {
        console.error("Chat failed", e);
        setMessages([
          ...newMessages,
          { role: "assistant", content: "(failed to get response)" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, images, loading, messages, options]
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
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
  sendMessage: () => void
) {
  if (e.key === "Enter") {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      // Cmd+Enter, Ctrl+Enter, or Shift+Enter = new line
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = input.slice(0, start) + "\n" + input.slice(end);
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
  file: File
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
  addImage: (image: ImageAttachment) => void
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
