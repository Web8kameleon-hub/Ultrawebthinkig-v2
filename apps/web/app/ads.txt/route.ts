import { NextResponse } from "next/server";
import { getAdsensePublisherAccountId } from "../../src/lib/ads/config";

export async function GET() {
  const accountId = getAdsensePublisherAccountId(process.env);
  const adsTxt = accountId
    ? `google.com, ${accountId}, DIRECT, f08c47fec0942fa0\n`
    : "# adsense publisher not configured\n";

  return new NextResponse(adsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
