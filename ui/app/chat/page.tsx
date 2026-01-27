import { getFS } from "@/lib/context";
import { getChats } from "@/lib/data/chats";
import type { ChatSummary } from "../../types";
import ChatClient from "./ChatClient";

async function fetchChats(): Promise<ChatSummary[]> {
	try {
		const fs = await getFS();
		return getChats(fs);
	} catch {
		return [];
	}
}

export default async function ChatPage() {
	const chats = await fetchChats();

	return <ChatClient initialChats={chats} />;
}
