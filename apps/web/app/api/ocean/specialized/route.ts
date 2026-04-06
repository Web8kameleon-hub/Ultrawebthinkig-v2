/**
 * SPECIALIZED CHAT PROXY
 * Routes specialized chat requests through Next.js to Ocean-Core
 * so the browser never needs direct access to the backend.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV !== "production";
const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const OCEAN_INTERNAL_URL = process.env.OCEAN_INTERNAL_URL;
const PUBLIC_OCEAN_URL =
  process.env.NEXT_PUBLIC_OCEAN_API_URL || "https://api.clisonix.com";
const INTERNAL_OCEAN_URL = "http://clisonix-ocean-core:8030";
const LOCAL_OCEAN_URL = "http://localhost:8030";
const REQUEST_TIMEOUT_MS = Number(
  process.env.OCEAN_SPECIALIZED_TIMEOUT_MS || "8000",
);
const FALLBACK_TIMEOUT_MS = Number(
  process.env.OCEAN_SPECIALIZED_FALLBACK_TIMEOUT_MS || "12000",
);

const DOMAIN_ALIASES: Record<string, string> = {
  neuro: "neuroscience",
  ai: "ai_ml",
  bio: "biotech",
  data: "data_science",
};

function normalizeDomain(domain?: string): string | undefined {
  if (!domain) return undefined;
  const normalized = domain.trim().toLowerCase();
  return DOMAIN_ALIASES[normalized] || normalized;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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
  payload: Record<string, unknown>,
) {
  const message = String(payload.message || payload.query || "").trim();
  const longResponse = payload.long_response === true;
  const requestedMaxTokens = Number(payload.max_tokens);
  const safePayload = {
    ...payload,
    long_response: longResponse,
    max_tokens:
      Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
        ? Math.min(
            Math.max(Math.trunc(requestedMaxTokens), 128),
            longResponse ? 1536 : 768,
          )
        : longResponse
          ? 768
          : 384,
  };

  try {
    const specializedRes = await fetchWithTimeout(
      `${upstream}/api/v1/chat/specialized`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safePayload),
      },
    );

    if (specializedRes.ok) {
      const data = await specializedRes.json();
      return { ok: true as const, data, source: "specialized" as const };
    }
  } catch {
    // fall through to standard chat
  }

  const binaryPreferred =
    payload.response_format === "cbor" ||
    payload.response_format === "cbor2" ||
    payload.response_format === "binary" ||
    payload.binary === true;

  if (binaryPreferred) {
    const { default: cbor } = await import("cbor");
    const binaryRes = await fetchWithTimeout(
      `${upstream}/api/v1/chat/binary`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/cbor",
          Accept: "application/cbor, application/json",
        },
        body: new Uint8Array(
          cbor.encode({
            ...safePayload,
            message,
            query: message,
            response_format: "cbor2",
          }),
        ),
      },
      FALLBACK_TIMEOUT_MS,
    );

    if (binaryRes.ok) {
      const contentType = (binaryRes.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/cbor")) {
        const decoded = cbor.decodeFirstSync(Buffer.from(await binaryRes.arrayBuffer()));
        return { ok: true as const, data: decoded, source: "binary" as const };
      }

      const maybeJson = await binaryRes.text();
      try {
        return {
          ok: true as const,
          data: JSON.parse(maybeJson),
          source: "binary" as const,
        };
      } catch {
        return {
          ok: true as const,
          data: { response: maybeJson },
          source: "binary" as const,
        };
      }
    }
  }

  const fastChatRes = await fetchWithTimeout(
    `${upstream}/api/v1/chat/fast`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...safePayload,
        message,
        query: message,
      }),
    },
    FALLBACK_TIMEOUT_MS,
  );

  if (fastChatRes.ok) {
    const data = await fastChatRes.json();
    return { ok: true as const, data, source: "chat_fast" as const };
  }

  const chatRes = await fetchWithTimeout(
    `${upstream}/api/v1/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...safePayload,
        message,
        query: message,
      }),
    },
    FALLBACK_TIMEOUT_MS,
  );

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
    const domain = normalizeDomain(
      typeof body.domain === "string" ? body.domain : undefined,
    );
    const language =
      typeof body.language === "string"
        ? body.language
        : typeof body.preferred_language === "string"
          ? body.preferred_language
          : undefined;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const candidates = buildUpstreamCandidates();
    const payload = {
      ...body,
      message,
      query: message,
      domain,
      language,
      preferred_language: language,
      messages: Array.isArray(body.messages) ? body.messages : undefined,
    } as Record<string, unknown>;

    let lastError = "No upstream candidates configured";

    for (const upstream of candidates) {
      try {
        const result = await trySpecializedOrChat(upstream, payload);
        if (result.ok) {
          const resultData = (result.data || {}) as Record<string, unknown>;
          const answerText =
            (typeof resultData.response === "string" && resultData.response) ||
            (typeof resultData.answer === "string" && resultData.answer) ||
            (typeof resultData.fused_answer === "string" &&
              resultData.fused_answer) ||
            "I am analyzing your request.";

          return NextResponse.json({
            ...resultData,
            response: answerText,
            answer:
              typeof resultData.answer === "string"
                ? resultData.answer
                : answerText,
            domain: domain || resultData.domain || resultData.query_category,
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
          "⚠️ Specialized chat timed out or Ocean Core is temporarily unavailable. Please try again in a few seconds.",
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
      const res = await fetchWithTimeout(
        `${upstream}/api/v1/status`,
        {
          method: "GET",
        },
        5000,
      );
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
