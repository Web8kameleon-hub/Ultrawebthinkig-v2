import { NextResponse } from "next/server";

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;
const OCEAN_LOCAL_URL = "http://localhost:8030";
const OCEAN_PUBLIC_URL = process.env.NEXT_PUBLIC_OCEAN_API_URL;

function buildOceanCandidates(): string[] {
  const ordered = [
    OCEAN_INTERNAL_URL,
    OCEAN_CORE_URL,
    OCEAN_LOCAL_URL,
    OCEAN_PUBLIC_URL,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));

  return [...new Set(ordered)];
}

async function parseIncomingBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/cbor")) {
    try {
      const { default: cbor } = await import("cbor");
      const raw = await request.arrayBuffer();
      const decoded = cbor.decodeFirstSync(Buffer.from(raw));
      if (decoded && typeof decoded === "object") {
        return decoded as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      throw new Error(
        `CBOR decode failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  const rawText = await request.text();
  const text = rawText?.trim();

  if (!text) {
    return {};
  }

  const parseCandidates = [
    text,
    text.replace(/\\"/g, '"'),
    text.replace(/^'(.*)'$/s, "$1"),
    text.replace(/^"(.*)"$/s, "$1"),
  ];

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }

  const messageMatch = text.match(/message\s*[:=]\s*["']([^"']+)["']/i);
  if (messageMatch?.[1]) {
    return { message: messageMatch[1] };
  }

  return { message: text };
}

export async function POST(request: Request) {
  try {
    const body = await parseIncomingBody(request);
    const question = (body.question || body.message || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    let lastError = "No upstream available";

    for (const upstream of buildOceanCandidates()) {
      try {
        const res = await fetch(`${upstream}/api/v1/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question }),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = `Upstream ${upstream} returned ${res.status}${errText ? `: ${errText}` : ""}`;
          continue;
        }

        const raw = await res.text();
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          data = { response: raw };
        }

        const responseText = (data.response || data.answer || "").toString().trim();
        if (!responseText) {
          lastError = `Upstream ${upstream} returned empty response`;
          continue;
        }
        return NextResponse.json({
          response: responseText,
          sources: data.sources || [],
          confidence: data.confidence ?? 0.5,
          query_category: data.query_category || "conversational",
          fast_path: true,
          upstream,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
      }
    }

    return NextResponse.json(
      { error: `Ocean-Core unavailable: ${lastError}`, fast_path: true },
      { status: 503 },
    );
  } catch (error) {
    console.error("[api/ocean/curiosity] request failed:", error);
    return NextResponse.json(
      {
        error: "Ocean-Core request failed",
        details: error instanceof Error ? error.message : "Unknown error",
        fast_path: true,
      },
      { status: 500 },
    );
  }
}
