"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";

export async function deleteChat(
  id: string,
): Promise<{ status: string; path: string }> {
  const fs = await getFS();

  const result = await fs.delete(`${PATHS.CHATS}/${id}.json`);

  revalidatePath("/chat");

  if ("error" in result) {
    return { status: "error", path: `${PATHS.CHATS}/${id}.json` };
  }
  return result;
}

export async function clearAllChats(): Promise<{
  status: string;
  prefix: string;
  deleted: number;
}> {
  const fs = await getFS();

  const result = await fs.clearPrefix(PATHS.CHATS);

  revalidatePath("/chat");
  return result;
}
