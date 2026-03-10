import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";
const ADS_CORE_URL =
  process.env.ADS_CORE_URL ||
  (isDev ? "http://localhost:8096" : "http://clisonix-ads-core:8096");

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const upstream = await fetch(`${ADS_CORE_URL}/api/v1/ads/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ ok: false, ignored: true }, { status: 200 });
  }
}
