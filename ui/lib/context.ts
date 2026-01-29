// Factory functions for creating service instances
import { cookies } from "next/headers";
import { PATHS } from "./constants";
import { GoogleCalendar, type GoogleTokens } from "./services/google-calendar";
import { SemanticFS } from "./services/semantic-fs";

const AUTH_BASE_URL =
  process.env.NEXT_PUBLIC_AUTH_BASE_URL || "http://localhost:3001/api/auth";

// Cache for SemanticFS instances per API key
const fsCache = new Map<string, SemanticFS>();

async function getServerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const response = await fetch(`${AUTH_BASE_URL}/token`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch {
    return null;
  }
}

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

// Helper to check if Google Calendar is connected
export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    const fs = await getFS();
    const tokens = await loadGoogleTokens(fs);
    return !!(tokens?.access_token && tokens?.refresh_token);
  } catch {
    return false;
  }
}
