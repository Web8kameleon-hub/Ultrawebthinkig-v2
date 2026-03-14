import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const PRIMARY_OCEAN_URL = process.env.OCEAN_INTERNAL_URL || process.env.OCEAN_CORE_URL;
const INTERNAL_OCEAN_URL = "http://clisonix-ocean-core:8030";
const LOCAL_OCEAN_URL = "http://localhost:8030";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  sq: "Albanian",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
  tr: "Turkish",
  nl: "Dutch",
  pl: "Polish",
};

function buildCandidates(): string[] {
  return [
    PRIMARY_OCEAN_URL,
    INTERNAL_OCEAN_URL,
    isDev ? LOCAL_OCEAN_URL : undefined,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = String(
      body.topic || body.prompt || body.message || "",
    ).trim();

    if (!topic) {
      return NextResponse.json(
        { error: "topic (or prompt/message) is required" },
        { status: 400 },
      );
    }

    const preferredLanguageRaw = String(body.preferred_language || body.language || "")
      .trim()
      .toLowerCase();
    const preferredLanguage = preferredLanguageRaw || undefined;

    const payload = {
      ...body,
      topic,
      preferred_language: preferredLanguage,
      language: preferredLanguage,
      language_name:
        body.language_name ||
        (preferredLanguage
          ? LANGUAGE_NAMES[preferredLanguage] || preferredLanguage.toUpperCase()
          : undefined),
      quality_profile: body.quality_profile || "high",
      language_layers:
        typeof body.language_layers === "number" ? body.language_layers : 4,
      response_format:
        body.response_format || (body.binary === true ? "cbor2" : "json"),
      binary: body.binary === true,
    };

    let lastError = "No upstream candidates configured";

    for (const upstream of buildCandidates()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        const res = await fetch(`${upstream}/api/v1/debate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const text = await res.text();
          try {
            return NextResponse.json(JSON.parse(text));
          } catch {
            return new NextResponse(text, {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
        }

        lastError = `Debate upstream ${upstream} returned ${res.status}`;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Unknown upstream error";
      }
    }

    return NextResponse.json(
      { error: "Debate unavailable", details: lastError },
      { status: 502 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  for (const upstream of buildCandidates()) {
    try {
      const res = await fetch(`${upstream}/health`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        return NextResponse.json({ status: "online", upstream });
      }
    } catch {
      // continue
    }
  }

  return NextResponse.json({ status: "offline" }, { status: 503 });
}
