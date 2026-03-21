import { NextResponse } from "next/server";

const DEFAULT_ADSENSE_PUBLISHER_ID = "ca-pub-4323173449597062";
const ADSENSE_ID_PATTERN = /^ca-pub-\d{16}$/;

function normalizePublisherId(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const canonical = trimmed.startsWith("ca-") ? trimmed : `ca-${trimmed}`;
  if (canonical.includes("XXXXXXXX")) return "";
  if (!ADSENSE_ID_PATTERN.test(canonical)) return "";
  return canonical.slice(3);
}

export async function GET() {
  const publisherId =
    normalizePublisherId(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID ?? "") ||
    normalizePublisherId(process.env.GOOGLE_ADSENSE_PUBLISHER_ID ?? "") ||
    normalizePublisherId(DEFAULT_ADSENSE_PUBLISHER_ID);

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
