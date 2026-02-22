"use server";

import { revalidatePath } from "next/cache";
import { getFS } from "@/lib/context";
import { saveChat } from "@/lib/data/chats";

export async function createChat(id: string): Promise<void> {
  const fs = await getFS();
  await saveChat(fs, id, "New Chat", []);
  revalidatePath("/chat");
}
