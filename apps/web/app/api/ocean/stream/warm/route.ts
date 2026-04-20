/**
 * OCEAN TYPEAHEAD WARM PROXY
 * ==========================
 * Called while the user is still typing (debounced ~400ms).
 * Triggers Ocean-Core to pre-fetch external context and build the
 * enriched prompt into its warm cache, so when the user hits Enter
 * the streaming response starts instantly (0ms context wait).
 *
 * Human-thinking model: Ocean "reads" the message before it's sent.
 */

import { createHash } from "node:crypto";
import { applyStrictUltraProfile } from "../../_lib/strict-ultra";

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const WARM_PROXY_MIN_INTERVAL_MS = Math.max(
  300,
  Number(process.env.OCEAN_WARM_PROXY_MIN_INTERVAL_MS || "1800"),
);
const WARM_PROXY_DEDUP_TTL_MS = Math.max(
  1000,
  Number(process.env.OCEAN_WARM_PROXY_DEDUP_TTL_MS || "20000"),
);

const _proxyClientWarmTs = new Map<string, number>();
const _proxyMessageWarmTs = new Map<string, number>();

function getUpstream(): string {
  return (OCEAN_INTERNAL_URL || PRIMARY_OCEAN_URL || "").replace(/\/+$/, "");
}

function getClientId(request: Request): string {
  const header =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  return header.split(",")[0]?.trim().toLowerCase() || "anonymous";
}

function cleanupWarmMaps(now: number): void {
  if (_proxyMessageWarmTs.size > 4000) {
    for (const [key, ts] of _proxyMessageWarmTs) {
      if (now - ts > WARM_PROXY_DEDUP_TTL_MS) _proxyMessageWarmTs.delete(key);
    }
  }
  if (_proxyClientWarmTs.size > 2000) {
    for (const [key, ts] of _proxyClientWarmTs) {
      if (now - ts > WARM_PROXY_DEDUP_TTL_MS) _proxyClientWarmTs.delete(key);
    }
  }
}

export async function POST(request: Request) {
  try {
    const parsedBody = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const strictUltra = applyStrictUltraProfile(parsedBody);
    const body = strictUltra.payload;
    const message = String(
      (body as Record<string, unknown>).message ||
        (body as Record<string, unknown>).query ||
        ""
    ).trim();

    if (!message || message.length < 6) {
      return Response.json({ status: "skipped", reason: "too_short" });
    }

    const now = Date.now();
    const clientId = getClientId(request);
    const lastClientTs = _proxyClientWarmTs.get(clientId) || 0;
    if (now - lastClientTs < WARM_PROXY_MIN_INTERVAL_MS) {
      return Response.json({ status: "skipped", reason: "rate_limited" });
    }

    const msgHash = createHash("sha1")
      .update(message.toLowerCase().slice(0, 240))
      .digest("hex");
    const dedupKey = `${clientId}:${msgHash}`;
    const lastMessageTs = _proxyMessageWarmTs.get(dedupKey) || 0;
    if (now - lastMessageTs < WARM_PROXY_DEDUP_TTL_MS) {
      return Response.json({ status: "already_warming" });
    }

    _proxyClientWarmTs.set(clientId, now);
    _proxyMessageWarmTs.set(dedupKey, now);
    cleanupWarmMaps(now);

    const upstream = getUpstream();
    if (!upstream) {
      return Response.json({ status: "skipped", reason: "no_upstream" });
    }

    // Fire-and-forget: we don't wait for the warm result.
    // The backend builds context asynchronously and caches it.
    const warmPayload = {
      message,
      language: (body as Record<string, unknown>).language,
      bit_mode: (body as Record<string, unknown>).bit_mode,
      token_budget: (body as Record<string, unknown>).token_budget,
      processing_mode: (body as Record<string, unknown>).processing_mode,
      curiosity_level: (body as Record<string, unknown>).curiosity_level,
      pre_enter: (body as Record<string, unknown>).pre_enter === true,
      user_id: (body as Record<string, unknown>).user_id,
    };

    const warmFetch = fetch(`${upstream}/api/v1/chat/stream/warm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...strictUltra.headers,
      },
      body: JSON.stringify(warmPayload),
    }).catch((err) => {
      console.warn("[Warm] upstream unreachable:", err?.message ?? err);
    });

    // Don't await — return instantly to the frontend.
    void warmFetch;

    return Response.json({ status: "warming" });
  } catch (err) {
    console.error("[Warm] proxy error:", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
