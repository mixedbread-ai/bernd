import { serverApi, API_ENDPOINTS } from "../lib/api.server";
import { ChatSummary } from "../types";
import ChatClient from "./ChatClient";

async function getChats(): Promise<ChatSummary[]> {
  try {
    const res = await serverApi.get(API_ENDPOINTS.chats);
    if (!res.ok) {
      return [];
    }
    return res.json();
  } catch {
    return [];
  }
}

export default async function ChatPage() {
  const chats = await getChats();

  return <ChatClient initialChats={chats} />;
}
