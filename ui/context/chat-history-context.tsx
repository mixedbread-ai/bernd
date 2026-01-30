"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ChatSummary, ImageAttachment } from "@/types";

export interface PendingMessage {
  text: string;
  images: ImageAttachment[];
}

interface ChatHistoryContextValue {
  isHistoryOpen: boolean;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chats: ChatSummary[];
  pendingMessage: PendingMessage | null;
  setPendingMessage: React.Dispatch<
    React.SetStateAction<PendingMessage | null>
  >;
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null);

export function useChatHistory() {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) {
    throw new Error("useChatHistory must be used within ChatHistoryProvider");
  }
  return ctx;
}

interface ChatHistoryProviderProps {
  chats: ChatSummary[];
  children: ReactNode;
}

export function ChatHistoryProvider({
  chats,
  children,
}: ChatHistoryProviderProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(
    null,
  );

  const value = useMemo(
    () => ({
      isHistoryOpen,
      setIsHistoryOpen,
      chats,
      pendingMessage,
      setPendingMessage,
    }),
    [isHistoryOpen, chats, pendingMessage],
  );

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}
