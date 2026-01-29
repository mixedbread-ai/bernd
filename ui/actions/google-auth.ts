"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";

export async function disconnectGoogleAction() {
  const fs = await getFS();

  await fs.delete(PATHS.GOOGLE_AUTH);

  revalidatePath("/settings");
}

export async function saveGoogleTokensAction(tokens: {
  access_token: string;
  refresh_token: string;
  expiry?: string;
}) {
  const fs = await getFS();

  await fs.write(PATHS.GOOGLE_AUTH, JSON.stringify(tokens, null, 2), {
    type: "auth",
  });

  revalidatePath("/settings");
}
