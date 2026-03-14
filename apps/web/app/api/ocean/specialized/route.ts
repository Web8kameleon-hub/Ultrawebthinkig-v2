/**
 * SPECIALIZED CHAT PROXY
 * Routes specialized chat requests through Next.js to Ocean-Core
 * so the browser never needs direct access to the backend.
 */

import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const OCEAN_INTERNAL_URL = process.env.OCEAN_INTERNAL_URL;
const PUBLIC_OCEAN_URL =
  process.env.NEXT_PUBLIC_OCEAN_API_URL || "https://api.clisonix.com";
const INTERNAL_OCEAN_URL = "http://clisonix-ocean-core:8030";
const LOCAL_OCEAN_URL = "http://localhost:8030";

function buildUpstreamCandidates(): string[] {
  return [
    OCEAN_INTERNAL_URL,
    INTERNAL_OCEAN_URL,
    PRIMARY_OCEAN_URL,
    PUBLIC_OCEAN_URL,
    isDev ? LOCAL_OCEAN_URL : undefined,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));
}

async function trySpecializedOrChat(
  upstream: string,
  message: string,
  domain?: string,
) {
  try {
    const specializedRes = await fetch(`${upstream}/api/v1/chat/specialized`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, domain }),
    });

    if (specializedRes.ok) {
      const data = await specializedRes.json();
      return { ok: true as const, data, source: "specialized" as const };
    }
  } catch {
    // fall through to standard chat
  }

  const chatRes = await fetch(`${upstream}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, query: message }),
  });

  if (!chatRes.ok) {
    const errorText = await chatRes.text();
    throw new Error(`Chat error ${chatRes.status}: ${errorText}`);
  }

  const data = await chatRes.json();
  return { ok: true as const, data, source: "chat" as const };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || body.query || "").trim();
    const domain = typeof body.domain === "string" ? body.domain : undefined;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const candidates = buildUpstreamCandidates();
    let lastError = "No upstream candidates configured";

    for (const upstream of candidates) {
      try {
        const result = await trySpecializedOrChat(upstream, message, domain);
        if (result.ok) {
          return NextResponse.json({
            ...result.data,
            domain:
              domain || result.data?.domain || result.data?.query_category,
            upstream,
            route_source: result.source,
          });
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Unknown upstream error";
      }
    }

    return NextResponse.json(
      {
        error: "Ocean Core unavailable",
        details: lastError,
        response:
          "⚠️ Ocean Core is temporarily unavailable. Please try again in a few seconds.",
        domain: domain || "general",
        confidence: 0,
      },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const candidates = buildUpstreamCandidates();

  for (const upstream of candidates) {
    try {
      const res = await fetch(`${upstream}/api/v1/status`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ status: "online", upstream, ...data });
      }
    } catch {
      // try next upstream
    }
  }

  return NextResponse.json({ status: "offline" }, { status: 503 });
}
