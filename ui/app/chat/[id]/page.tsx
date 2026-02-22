import { notFound } from "next/navigation";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { getFS } from "@/lib/context";
import { getChat } from "@/lib/data/chats";

export default async function ChatDetailPage({
  params,
}: PageProps<"/chat/[id]">) {
  const { id } = await params;

  const fs = await getFS();
  const chat = await getChat(fs, id);

  if (!chat) {
    notFound();
  }

  return <ChatConversation chatId={id} initialChat={chat} />;
}
