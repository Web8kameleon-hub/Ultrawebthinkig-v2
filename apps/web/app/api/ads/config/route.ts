import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";
const ADS_CORE_URL =
  process.env.ADS_CORE_URL ||
  (isDev ? "http://localhost:8096" : "http://clisonix-ads-core:8096");

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slot = url.searchParams.get("slot") || "footer";
    const consent = url.searchParams.get("consent") || "false";
    const country = url.searchParams.get("country") || "";

    const upstream = await fetch(
      `${ADS_CORE_URL}/api/v1/ads/config?slot=${encodeURIComponent(slot)}&consent=${encodeURIComponent(consent)}&country=${encodeURIComponent(country)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ads_config_proxy_failed";
    return NextResponse.json(
      {
        enabled: false,
        reason: "proxy_error",
        provider: "none",
        slot: "footer",
        fallback_text: message,
      },
      { status: 200 },
    );
  }
}
