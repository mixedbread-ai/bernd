"use client";

import { useState, useCallback } from "react";
import { Message, ToolCall, StreamEvent } from "../types";
import { API_ENDPOINTS } from "../config";

interface UseChatOptions {
  onChatSaved?: (chatId: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  streamingToolCalls: ToolCall[];
  streamingContent: string;
  sendMessage: (chatId?: string | null) => Promise<void>;
  clearChat: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingContent, setStreamingContent] = useState("");

  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamingContent("");
    setStreamingToolCalls([]);
  }, []);

  const sendMessage = useCallback(
    async (chatId?: string | null) => {
      if (!input.trim() || loading) return;

      const userMessage: Message = { role: "user", content: input.trim() };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setLoading(true);
      setStreamingToolCalls([]);
      setStreamingContent("");

      try {
        const res = await fetch(API_ENDPOINTS.chatStream, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages, chat_id: chatId }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        const toolCalls: ToolCall[] = [];
        let finalContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as StreamEvent;
                  if (data.type === "tool_call") {
                    toolCalls.push({ name: data.name, args: data.args });
                    setStreamingToolCalls([...toolCalls]);
                  } else if (data.type === "text_delta") {
                    finalContent += data.delta;
                    setStreamingContent(finalContent);
                  } else if (data.type === "response_end") {
                    finalContent = data.content;
                    setStreamingContent(finalContent);
                  } else if (data.type === "chat_saved") {
                    options.onChatSaved?.(data.chat_id);
                  }
                } catch {
                  // ignore parse errors
                }
              }
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
    [input, loading, messages, options]
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
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
