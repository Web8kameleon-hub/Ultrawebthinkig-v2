import { NextResponse } from "next/server";
import {
  buildHumanThinkingSystemPrompt,
  getHumanThinkingProfile,
} from "../../../lib/oceanHumanThinking";

// Allow up to 300s for ocean-core to process through its engine stack
export const maxDuration = 300;
import {
  buildWebResearchSystemMessage,
  performWebResearch,
  shouldUseWebResearch,
} from "../../../lib/oceanResearch";
import {
  buildDecisionSupport,
  buildDecisionSystemMessage,
  shouldUseDecisionMode,
} from "../../../lib/oceanDecisionSupport";
import {
  buildSignalSystemMessage,
  collectOceanSignalSnapshot,
} from "../../../lib/oceanSignalHub";
import {
  detectProcessingMode,
  type ProcessingMode,
} from "../../../lib/oceanComplexity";

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

// Prefer internal Docker service URL first; keep localhost/public upstream candidates
const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_CORE_URL = process.env.OCEAN_CORE_URL;
const OCEAN_LOCAL_URL = "http://localhost:8030";
const OCEAN_PUBLIC_URL = process.env.NEXT_PUBLIC_OCEAN_API_URL;
const isDev = process.env.NODE_ENV !== "production";

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
  return question.trim();
}

function resolveEffectiveQuestion(
  question: string,
  messages?: Array<{ role?: string; content?: string }>,
): string {
  const clean = question.trim();
  if (!clean) return clean;

  const isShortFollowUp =
    clean.length <= 40 &&
    /^(po|ok|okej|beje|beje testin|vazhdo|vazhdojme|continue|do it|go ahead|yes|yep|sure)$/i.test(
      clean,
    );

  if (!isShortFollowUp || !Array.isArray(messages) || messages.length === 0) {
    return clean;
  }

  const priorUser = [...messages]
    .reverse()
    .find(
      (item) =>
        item?.role === "user" &&
        typeof item?.content === "string" &&
        item.content.trim().length > 0,
    );

  if (!priorUser) {
    return clean;
  }

  return `${priorUser.content.trim()}\n\nFollow-up instruction from user: ${clean}`;
}

function buildOceanCandidates(): string[] {
  const ordered = [
    OCEAN_INTERNAL_URL,
    OCEAN_CORE_URL,
    isDev ? OCEAN_LOCAL_URL : undefined,
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
  options?: {
    language?: string;
    messages?: Array<{ role: string; content: string }>;
    preferBinary?: boolean;
    processingMode?: ProcessingMode;
  },
): Promise<OceanCoreResponse | null> {
  for (const upstream of buildOceanCandidates()) {
    try {
      let response: Response;
      const chatPath =
        options?.processingMode === "fast"
          ? "/api/v1/chat/fast"
          : "/api/v1/chat";

      if (options?.preferBinary) {
        const { default: cbor } = await import("cbor");
        const payload = {
          message: question,
          query: question,
          language: options.language,
          messages: options.messages,
          enable_companion: true,
          enable_feeling_layer: true,
          response_format: "cbor2",
        };

        response = await fetch(`${upstream}/api/v1/chat/binary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/cbor",
            Accept: "application/cbor, application/json",
          },
          body: new Uint8Array(cbor.encode(payload)),
        });
      } else {
        response = await fetch(`${upstream}${chatPath}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: question,
            query: question,
            language: options?.language,
            messages: options?.messages,
            enable_companion: true,
            enable_feeling_layer: true,
            processing_mode: options?.processingMode || "deep",
          }),
        });
      }

      if (!response.ok) {
        console.error(`Ocean-Core ${upstream} returned ${response.status}`);
        continue;
      }

      let data: Record<string, any>;
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (contentType.includes("application/cbor")) {
        const { default: cbor } = await import("cbor");
        const raw = Buffer.from(await response.arrayBuffer());
        data = cbor.decodeFirstSync(raw) as Record<string, any>;
      } else {
        data = (await response.json()) as Record<string, any>;
      }

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
    const preferBinary =
      body.response_format === "cbor" ||
      body.response_format === "cbor2" ||
      body.response_format === "binary" ||
      body.binary === true;
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
          .map((item) => ({
            role: item.role as string,
            content: item.content as string,
          }))
      : undefined;
    const effectiveQuestion = resolveEffectiveQuestion(question, messages);
    const complexity = detectProcessingMode(
      effectiveQuestion,
      body.processing_mode,
    );
    const signalSnapshot =
      body.signal_mode === false || !complexity.shouldUseSignals
        ? null
        : await collectOceanSignalSnapshot(effectiveQuestion);
    const signalSystemMessage = buildSignalSystemMessage(signalSnapshot);
    const webResearchRequested =
      (complexity.shouldUseResearch && body.web_research !== false) ||
      body.web_research === true ||
      body.use_web === true ||
      (complexity.shouldUseResearch && shouldUseWebResearch(effectiveQuestion));
    const researchPacket = webResearchRequested
      ? await performWebResearch(effectiveQuestion)
      : null;
    const researchSystemMessage = buildWebResearchSystemMessage(researchPacket);
    const decisionSupport =
      body.decision_mode === true ||
      (complexity.shouldUseDecision && shouldUseDecisionMode(effectiveQuestion))
        ? buildDecisionSupport(effectiveQuestion, researchPacket)
        : null;
    const decisionSystemMessage = buildDecisionSystemMessage(
      effectiveQuestion,
      decisionSupport,
    );
    const stitchedMessages = [
      {
        role: "system" as const,
        content: buildHumanThinkingSystemPrompt(language),
      },
      ...(signalSystemMessage
        ? ([
            { role: "system" as const, content: signalSystemMessage },
          ] as const)
        : []),
      ...(researchSystemMessage
        ? ([
            { role: "system" as const, content: researchSystemMessage },
          ] as const)
        : []),
      ...(decisionSystemMessage
        ? ([
            { role: "system" as const, content: decisionSystemMessage },
          ] as const)
        : []),
      ...(messages || []),
    ];

    if (!question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    // Try Ocean-Core first (the REAL AI backend)
    const oceanResponse = await queryOceanCore(
      buildOceanPrompt(effectiveQuestion, language),
      {
        language,
        messages: stitchedMessages,
        preferBinary,
        processingMode: complexity.mode,
      },
    );

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
        behavior_profile: getHumanThinkingProfile(),
        confidence: oceanResponse.confidence,
        sources_consulted: Array.from(
          new Set([
            ...oceanResponse.sources_consulted,
            ...(researchPacket?.sources.map((source) => source.url) || []),
            ...(signalSnapshot?.openDataLinks.map((link) => link.url) || []),
          ]),
        ),
        signals: signalSnapshot,
        processing_mode: complexity,
        research: researchPacket,
        decision_support: decisionSupport,
        intent: oceanResponse.intent,
      });
    }

    return NextResponse.json(
      {
        error: "Ocean-Core service unavailable",
        source: "Ocean-Core",
        mode: curiosity_level,
        behavior_profile: getHumanThinkingProfile(),
        signals: signalSnapshot,
        processing_mode: complexity,
        research: researchPacket,
        decision_support: decisionSupport,
      },
      { status: 503 },
    );
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

  return NextResponse.json({
    status: oceanCoreHealthy ? "connected" : "ocean-core-offline",
    ocean_core_candidates: buildOceanCandidates(),
    environment: process.env.NODE_ENV || "unknown",
    message: oceanCoreHealthy
      ? "🌊 Ocean-Core Knowledge Engine is active with 14 Specialist Personas and human-thinking orchestration"
      : "⚠️ Ocean-Core offline. Start with: cd ocean-core && python -m uvicorn ocean_api:app --port 8030",
    behavior_profile: getHumanThinkingProfile(),
    features: [
      "14 Specialist Personas",
      "Knowledge Engine",
      "Multi-source aggregation",
      "Curiosity Threads",
      "Domain-specific routing",
      "Human-thinking orchestration",
      "Responsibility-aware responses",
      "Natural web research orchestration",
      "Decision-support mode",
      "Signal Hub (internal + external free data)",
    ],
  });
}
