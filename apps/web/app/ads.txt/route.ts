import { NextResponse } from "next/server";
import { getAdsensePublisherAccountId } from "../../src/lib/ads/config";

export async function GET() {
  const publisherId = getAdsensePublisherAccountId();

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
