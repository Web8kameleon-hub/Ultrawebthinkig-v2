import { NextResponse } from "next/server";

function normalizePublisherId(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("ca-")) return trimmed.slice(3);
  return trimmed;
}

export async function GET() {
  const publisherId = normalizePublisherId(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID ?? "");

  if (!publisherId) {
    return new NextResponse("# ads.txt not configured\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const body = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
