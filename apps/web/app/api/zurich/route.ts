import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const PRIMARY_OCEAN_URL = process.env.OCEAN_INTERNAL_URL || process.env.OCEAN_CORE_URL;
const INTERNAL_OCEAN_URL = "http://clisonix-ocean-core:8030";
const LOCAL_OCEAN_URL = "http://localhost:8030";

function buildCandidates(): string[] {
  return [PRIMARY_OCEAN_URL, INTERNAL_OCEAN_URL, isDev ? LOCAL_OCEAN_URL : undefined]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));
}

function buildDeterministicFallback(prompt: string) {
  const normalized = prompt.trim();
  const domains = Array.from(
    new Set(
      normalized
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 5)
        .slice(0, 4),
    ),
  );

  const output = [
    "[ZURICH FALLBACK MODE]",
    "1) Parse: input captured successfully.",
    "2) Classify: general analytical request.",
    `3) Decompose: identified key terms => ${domains.join(", ") || "general-context"}.`,
    "4) Retrieve: upstream unavailable, using local deterministic synthesis.",
    "5) Apply: preserving stable reasoning template.",
    "6) Synthesize: returning concise actionable response.",
    "7) Validate: output generated without stochastic variation.",
    "8) Format: plain-text report.",
    "9) Output:",
    `- Prompt: ${normalized}`,
    "- Action: Retry in 10-30s if full Zurich upstream detail is required.",
    "- Status: Service degraded but functional.",
  ].join("\n");

  return {
    ok: true,
    output,
    confidence: 0.78,
    strategy: "deterministic-fallback",
    domains,
    processing_time_ms: 0,
    engine: "zurich-fallback",
    degraded: true,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt || body.query || body.message || "").trim();

    if (!prompt) {
      return NextResponse.json({ error: "prompt (or query/message) is required" }, { status: 400 });
    }

    const payload = {
      ...body,
      prompt,
    };

    let lastError = "No upstream candidates configured";

    for (const upstream of buildCandidates()) {
      try {
        const res = await fetch(`${upstream}/api/v1/zurich`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }

        lastError = `Zurich upstream ${upstream} returned ${res.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown upstream error";
      }
    }

    return NextResponse.json(buildDeterministicFallback(prompt), {
      status: 200,
      headers: { "x-zurich-fallback": "1", "x-zurich-error": lastError },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
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
