import { NextResponse } from "next/server";

/**
 * CURIOSITY OCEAN API - Powered by Ocean-Core Knowledge Engine
 *
 * UPGRADED: Now connects to REAL AI backend with 14 Specialist Personas
 * NO MORE fixed responses - connects to ocean-core SaaS
 *
 * Ocean-Core Features:
 * - 14 Expert Personas for domain-specific responses
 * - Knowledge Engine with multi-source aggregation
 * - Curiosity Threads for deeper exploration
 * - Real-time analysis and intelligent responses
 *
 * Personas available:
 * - neuroscience_expert, ai_specialist, data_analyst
 * - systems_engineer, security_expert, medical_advisor
 * - wellness_coach, creative_director, performance_optimizer
 * - research_scientist, business_strategist, technical_writer
 * - ux_specialist, ethics_advisor
 */

const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;
function resolveOceanUpstream(): string {
  const upstream = (OCEAN_INTERNAL_URL || OCEAN_CORE_URL || "").trim();
  if (!upstream) {
    throw new Error("Ocean upstream is not configured");
  }
  return upstream.replace(/\/+$/, "");
}

async function parseIncomingBody(
  request: Request,
): Promise<Record<string, unknown>> {
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
    text.replace(/^'([\s\S]*)'$/, "$1"),
    text.replace(/^"([\s\S]*)"$/, "$1"),
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

function buildOceanPrompt(question: string, language?: string): string {
  void language;
  return question;
}

function normalizeSSEText(raw: unknown): string {
  const text = typeof raw === "string" ? raw : "";
  if (!text || !text.includes("data:")) return text;

  const lines = text.split(/\r?\n/);
  let rebuilt = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    try {
      const parsed = JSON.parse(payload);
      if (
        parsed?.status === "connected" ||
        parsed?.status === "complete" ||
        typeof parsed?.metadata !== "undefined"
      ) {
        continue;
      }

      if (typeof parsed?.chunk === "string") rebuilt += parsed.chunk;
      else if (typeof parsed?.response === "string") rebuilt += parsed.response;
      else if (typeof parsed?.text === "string") rebuilt += parsed.text;
      else if (typeof parsed?.error === "string")
        rebuilt += `⚠️ ${parsed.error}`;
    } catch {
      rebuilt += payload;
    }
  }

  return rebuilt || text;
}

interface OceanCoreResponse {
  query: string;
  intent: string;
  response: string;
  persona_answer?: string;
  persona_used?: string;
  key_findings: string[];
  curiosity_threads: Array<{
    title: string;
    hook: string;
    depth_level: string;
  }>;
  sources_consulted: string[];
  confidence: number;
}

/**
 * Query the Ocean-Core Knowledge Engine
 */
async function queryOceanCore(
  question: string,
  language?: string,
  messages?: Array<{ role: string; content: string }>,
): Promise<OceanCoreResponse> {
  const prompt = buildOceanPrompt(question, language);
  const upstream = resolveOceanUpstream();

  const response = await fetch(`${upstream}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: prompt,
      messages,
      language,
      user_language: language,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `UPSTREAM_STATUS:${response.status}:${detail || "Ocean-Core request failed"}`,
    );
  }

  const data = await response.json();
  const cleanResponse = normalizeSSEText(data.response);
  return {
    query: question,
    intent: data.query_category || "general",
    response: cleanResponse,
    persona_answer: cleanResponse,
    persona_used: data.sources?.[0] || "ocean-core",
    key_findings: [],
    curiosity_threads: [],
    sources_consulted: data.sources || [],
    confidence: data.confidence || 0.9,
  };
}

/**
 * Check Ocean-Core health status
 */
async function checkOceanCoreHealth(): Promise<boolean> {
  try {
    const upstream = resolveOceanUpstream();
    const response = await fetch(`${upstream}/api/v1/status`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseIncomingBody(request);
    // Accept both 'question' and 'message' for flexibility
    const question =
      typeof body.question === "string"
        ? body.question
        : typeof body.message === "string"
          ? body.message
          : "";
    const language =
      typeof body.language === "string" ? body.language : undefined;
    const curiosity_level = body.curiosity_level || "curious";
    const messages = Array.isArray(body.messages)
      ? (body.messages as Array<{ role?: string; content?: string }>)
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.role === "string" &&
              typeof item.content === "string" &&
              item.content.trim().length > 0,
          )
          .slice(-20)
          .map((item) => ({
            role: item.role as string,
            content: item.content as string,
          }))
      : undefined;

    if (!question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const oceanResponse = await queryOceanCore(question, language, messages);
    return NextResponse.json({
      ocean_response: oceanResponse.response,
      persona_answer: oceanResponse.persona_answer,
      persona_used: oceanResponse.persona_used,
      rabbit_holes: oceanResponse.curiosity_threads.map((t) => t.title),
      next_questions: oceanResponse.curiosity_threads.map((t) => t.hook),
      key_findings: oceanResponse.key_findings,
      mode: curiosity_level,
      source: "Ocean-Core Knowledge Engine",
      confidence: oceanResponse.confidence,
      sources_consulted: oceanResponse.sources_consulted,
      intent: oceanResponse.intent,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown";
    if (errMsg.startsWith("UPSTREAM_STATUS:")) {
      const [_, statusRaw, ...detailParts] = errMsg.split(":");
      const status = Number(statusRaw) || 502;
      const detail =
        detailParts.join(":").trim() || "Ocean-Core request failed";
      return NextResponse.json(
        {
          error: detail,
          source: "Ocean-Core",
        },
        { status },
      );
    }
    console.error("Ocean API error:", errMsg);
    return NextResponse.json(
      {
        error: "Ocean API request failed",
        details: errMsg,
      },
      { status: 500 },
    );
  }
}

/**
 * GET: Health check and status
 */
export async function GET() {
  const oceanCoreHealthy = await checkOceanCoreHealth();
  const oceanCandidate = (() => {
    try {
      return [resolveOceanUpstream()];
    } catch {
      return [] as string[];
    }
  })();

  return NextResponse.json({
    status: oceanCoreHealthy ? "connected" : "ocean-core-offline",
    ocean_core_candidates: oceanCandidate,
    environment: process.env.NODE_ENV || "unknown",
    message: oceanCoreHealthy
      ? "🌊 Ocean-Core Knowledge Engine is active with 14 Specialist Personas"
      : "⚠️ Ocean-Core offline. Start with: cd ocean-core && python -m uvicorn ocean_api:app --port 8030",
    features: [
      "14 Specialist Personas",
      "Knowledge Engine",
      "Multi-source aggregation",
      "Curiosity Threads",
      "Domain-specific routing",
    ],
  });
}
