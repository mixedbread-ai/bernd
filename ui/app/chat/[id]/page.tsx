import { notFound } from "next/navigation";
import { getFS } from "@/lib/context";
import { getChat } from "@/lib/data/chats";
import { ChatClient } from "../chat-client";

export default async function ChatDetailPage({
  params,
}: PageProps<"/chat/[id]">) {
  const { id } = await params;

  const fs = await getFS();
  const chat = await getChat(fs, id);

  if (!chat) {
    notFound();
  }

  return <ChatClient initialChat={chat} />;
}
