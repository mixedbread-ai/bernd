"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ChatSummary } from "@/types";

interface ChatHistoryContextValue {
  isHistoryOpen: boolean;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chats: ChatSummary[];
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

  const value = useMemo(
    () => ({ isHistoryOpen, setIsHistoryOpen, chats }),
    [isHistoryOpen, chats],
  );

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}
