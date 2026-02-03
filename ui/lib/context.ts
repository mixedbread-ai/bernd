import { PATHS } from "@/lib/constants";
import { getServerToken } from "@/lib/server-auth";
import {
  GoogleCalendar,
  type GoogleTokens,
} from "@/lib/services/google-calendar";
import { SemanticFS } from "@/lib/services/semantic-fs";

const fsCache = new Map<string, SemanticFS>();

export async function getFS(): Promise<SemanticFS> {
  const token = await getServerToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  let fs = fsCache.get(token);
  if (!fs) {
    fs = new SemanticFS(token);
    fsCache.set(token, fs);
  }

  return fs;
}

export async function getApiKey(): Promise<string> {
  const token = await getServerToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return token;
}

interface StoredGoogleTokens extends GoogleTokens {
  client_id?: string;
  client_secret?: string;
}

async function loadGoogleTokens(
  fs: SemanticFS,
): Promise<StoredGoogleTokens | null> {
  try {
    const result = await fs.read(PATHS.GOOGLE_AUTH);
    return JSON.parse(result.content) as StoredGoogleTokens;
  } catch {
    return null;
  }
}

async function saveGoogleTokens(
  fs: SemanticFS,
  tokens: GoogleTokens,
): Promise<void> {
  const existing = await loadGoogleTokens(fs);
  const toSave: StoredGoogleTokens = {
    ...existing,
    ...tokens,
  };
  await fs.write(PATHS.GOOGLE_AUTH, JSON.stringify(toSave, null, 2));
}

export async function getGoogleCalendar(): Promise<GoogleCalendar | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const fs = await getFS();
  const tokens = await loadGoogleTokens(fs);

  if (!tokens?.access_token || !tokens?.refresh_token) {
    return null;
  }

  return new GoogleCalendar(
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: tokens.expiry,
    },
    clientId,
    clientSecret,
    (newTokens) => saveGoogleTokens(fs, newTokens),
  );
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    const fs = await getFS();
    const tokens = await loadGoogleTokens(fs);
    return !!(tokens?.access_token && tokens?.refresh_token);
  } catch {
    return false;
  }
}
