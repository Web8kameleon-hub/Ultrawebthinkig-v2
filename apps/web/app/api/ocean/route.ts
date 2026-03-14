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

// Prefer internal Docker service URL first; keep localhost/public fallbacks
const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;
const OCEAN_LOCAL_URL = "http://localhost:8030";
const OCEAN_PUBLIC_URL = process.env.NEXT_PUBLIC_OCEAN_API_URL;

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
): Promise<OceanCoreResponse | null> {
  for (const upstream of buildOceanCandidates()) {
    try {
      const response = await fetch(`${upstream}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
        }),
      });

      if (!response.ok) {
        console.error(`Ocean-Core ${upstream} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      return {
        query: question,
        intent: data.query_category || "general",
        response: data.response,
        persona_answer: data.response,
        persona_used: data.sources?.[0] || "ocean-core",
        key_findings: [],
        curiosity_threads: [],
        sources_consulted: data.sources || [],
        confidence: data.confidence || 0.9,
      };
    } catch (error) {
      console.error(`Ocean-Core ${upstream} connection failed:`, error);
    }
  }

  return null;
}

/**
 * Check Ocean-Core health status
 */
async function checkOceanCoreHealth(): Promise<boolean> {
  for (const upstream of buildOceanCandidates()) {
    try {
      const response = await fetch(`${upstream}/api/v1/status`);
      if (response.ok) {
        return true;
      }
    } catch {
      // try next candidate
    }
  }

  return false;
}

/**
 * Fallback: Get system status from main API
 */
async function getSystemStatus(): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/asi/status`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Ignore errors
  }
  return {};
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

    // Try Ocean-Core first (the REAL AI backend)
    const oceanResponse = await queryOceanCore(question);

    if (oceanResponse) {
      // SUCCESS: Got response from Ocean-Core Knowledge Engine
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
    }

    // FALLBACK: Ocean-Core not available
    console.warn("Ocean-Core not available, using fallback response");

    // Get system status for context
    const systemStatus = await getSystemStatus();

    // Generate helpful fallback response
    const fallbackResponse = `🌊 **Ocean-Core Knowledge Engine Starting...**

Your question: "${question}"

The Ocean-Core AI system is initializing. This system features:
• 14 Specialist Personas for domain-specific expertise
• Knowledge Engine with multi-source aggregation
• Curiosity Threads for deeper exploration

**To start Ocean-Core:**
\`\`\`bash
cd ocean-core
python -m uvicorn ocean_api:app --port 8030
\`\`\`

Or ensure the Ocean-Core service is running on port 8030.

${systemStatus?.status ? `\n📊 **System Status:** ${JSON.stringify(systemStatus.status)}` : ""}`;

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
    ocean_core_candidates: buildOceanCandidates(),
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
