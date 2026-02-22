import type { ReactNode } from "react";
import { ChatHistoryPanel } from "@/components/chat/chat-history-panel";
import { ChatHistoryProvider } from "@/context/chat-history-context";
import { getFS } from "@/lib/context";
import { getChats } from "@/lib/data/chats";

export default async function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  const fs = await getFS();
  const chats = await getChats(fs);

  return (
    <ChatHistoryProvider chats={chats}>
      {children}
      <ChatHistoryPanel />
    </ChatHistoryProvider>
  );
}
