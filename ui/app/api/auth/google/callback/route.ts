import { google } from "googleapis";
import { type NextRequest, NextResponse } from "next/server";
import { saveGoogleTokens } from "@/actions/google-auth";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Base redirect URL
  const redirectUrl = new URL("/settings", req.url);

  if (error) {
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set("error", "No authorization code provided");
    return NextResponse.redirect(redirectUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    redirectUrl.searchParams.set("error", "Google OAuth not configured");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      redirectUrl.searchParams.set("error", "Failed to get tokens");
      return NextResponse.redirect(redirectUrl);
    }

    // Save tokens using Server Action
    await saveGoogleTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
    });

    redirectUrl.searchParams.set("success", "Google Calendar connected");
    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    console.error("[Google OAuth] Error exchanging code:", e);
    redirectUrl.searchParams.set("error", "Failed to connect Google Calendar");
    return NextResponse.redirect(redirectUrl);
  }
}

// Start OAuth flow
export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 },
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  });

  return NextResponse.json({ authUrl });
}
