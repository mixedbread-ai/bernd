"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import { type Chat, getChat } from "@/lib/data/chats";

export async function getChatAction(id: string): Promise<Chat | null> {
  const fs = await getFS();
  return getChat(fs, id);
}

export async function deleteChatAction(id: string, isActive?: boolean) {
  const fs = await getFS();

  await fs.delete(`${PATHS.CHATS}/${id}.json`);

  revalidatePath("/chat");

  if (isActive) {
    redirect("/chat");
  }
}

export async function clearAllChatsAction() {
  const fs = await getFS();

  await fs.clearPrefix(PATHS.CHATS);

  revalidatePath("/chat");
}
