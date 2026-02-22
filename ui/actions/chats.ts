"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";

export async function deleteChatAction(id: string, isActive?: boolean) {
  const fs = await getFS();

  await Promise.all([
    fs.delete(`${PATHS.CHATS}/${id}.json`),
    fs.clearPrefix(`${PATHS.CHAT_ASSETS}/${id}/`),
  ]);

  revalidatePath("/chat");

  if (isActive) {
    redirect("/chat");
  }
}
