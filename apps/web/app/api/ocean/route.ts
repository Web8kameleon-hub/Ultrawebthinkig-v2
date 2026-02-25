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

// Fallback URL for internal API (used when ocean-core not available)
const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  (process.env.NODE_ENV !== "production"
    ? "http://localhost:8000"
    : "http://api:8000");

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
    const body = await request.json();
    // Accept both 'question' and 'message' for flexibility
    const question = body.question || body.message;
    const curiosity_level = body.curiosity_level || "curious";

    if (!question?.trim()) {
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
      ocean_response: fallbackResponse,
      rabbit_holes: [
        "Start Ocean-Core service",
        "Check port 8030",
        "View system logs",
      ],
      next_questions: [
        "How to start Ocean-Core?",
        "What personas are available?",
        "How does the Knowledge Engine work?",
      ],
      mode: curiosity_level,
      source: "Fallback (Ocean-Core not available)",
      ocean_core_status: "offline",
      startup_hint: `cd ocean-core && python -m uvicorn ocean_api:app --port 8030`,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown";
    console.error("Ocean API error:", errMsg);
    return NextResponse.json(
      {
        ocean_response: "🌊 The Ocean is recalibrating. Please try again.",
        rabbit_holes: [],
        next_questions: [],
        error: errMsg,
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
