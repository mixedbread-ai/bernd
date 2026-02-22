"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS } from "@/lib/context";
import { encrypt } from "@/lib/crypto";

export async function getGoogleStatusAction(): Promise<{
  connected: boolean;
  connected_at?: string;
}> {
  try {
    const fs = await getFS();
    const result = await fs.read(PATHS.GOOGLE_AUTH);
    const tokens = JSON.parse(result.content);
    const connected = !!(tokens?.access_token && tokens?.refresh_token);
    return {
      connected,
      connected_at: connected ? result.metadata.created_at : undefined,
    };
  } catch {
    return { connected: false };
  }
}

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

  const encryptedTokens = {
    ...tokens,
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token),
  };

  await fs.write(PATHS.GOOGLE_AUTH, JSON.stringify(encryptedTokens, null, 2), {
    type: "auth",
  });

  revalidatePath("/settings");
}
