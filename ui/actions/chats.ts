"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";

export async function deleteChatAction(id: string, isActive?: boolean) {
  const fs = await getFS();

  await fs.delete(`${PATHS.CHATS}/${id}.json`);

  revalidatePath("/chat");

  if (isActive) {
    redirect("/chat");
  }
}
