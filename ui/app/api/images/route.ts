import { type NextRequest, NextResponse } from "next/server";
import { getFS } from "@/lib/context";

const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path || !path.startsWith("/chat_assets/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const fs = await getFS();
    const result = await fs.readBinary(path);

    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    return new NextResponse(result.data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
