"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";

export async function disconnectGoogle(): Promise<{ status: string }> {
  const fs = await getFS();

  await fs.delete(PATHS.GOOGLE_AUTH);

  revalidatePath("/settings");
  return { status: "disconnected" };
}

export async function saveGoogleTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expiry?: string;
}): Promise<{ status: string }> {
  const fs = await getFS();

  await fs.write(PATHS.GOOGLE_AUTH, JSON.stringify(tokens, null, 2), {
    type: "auth",
  });

  revalidatePath("/settings");
  return { status: "saved" };
}
