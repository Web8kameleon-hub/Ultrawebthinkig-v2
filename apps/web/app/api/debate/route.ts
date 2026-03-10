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

const DEBATE_PERSONAS = [
  { id: "alba", name: "Alba", emoji: "🌅", role: "Optimist" },
  { id: "albi", name: "Albi", emoji: "🔧", role: "Pragmatist" },
  { id: "jona", name: "Jona", emoji: "🔍", role: "Skeptic" },
  { id: "blerina", name: "Blerina", emoji: "💡", role: "Analyst" },
  { id: "asi", name: "ASI", emoji: "🧠", role: "Meta-Thinker" },
] as const;

function detectLanguageHint(input: string): string {
  const text = input.toLowerCase();

  const hasAlbanianChars = /[çë]/i.test(input);
  const albanianKeywords =
    /\b(është|jam|nuk|dhe|që|si|për|një|kjo|këtë|mirë|faleminderit)\b/i;
  if (hasAlbanianChars || albanianKeywords.test(text)) return "sq";

  if (/\b(und|nicht|ist|wie|warum|danke|bitte|über)\b/i.test(text)) return "de";
  if (/\b(le|la|les|est|pourquoi|merci|avec|être)\b/i.test(text)) return "fr";
  if (/\b(il|lo|gli|è|perché|grazie|con|sono)\b/i.test(text)) return "it";
  if (/\b(el|la|los|las|porque|gracias|con|está|cómo)\b/i.test(text))
    return "es";
  if (/\b(ve|bir|bu|için|neden|teşekkür|nasıl)\b/i.test(text)) return "tr";
  if (/\b(o|a|os|as|porque|obrigado|como|está)\b/i.test(text)) return "pt";

  return "en";
}

function buildCandidates(): string[] {
  return [
    PRIMARY_OCEAN_URL,
    INTERNAL_OCEAN_URL,
    isDev ? LOCAL_OCEAN_URL : undefined,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));
}

function extractChatText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as Record<string, unknown>;
  const candidate =
    data.response ||
    data.ocean_response ||
    data.persona_answer ||
    data.answer ||
    data.text;
  return typeof candidate === "string" ? candidate.trim() : "";
}

async function callChatFallback(
  upstream: string,
  topic: string,
  languageCode: string,
  languageName: string,
) {
  const responses = [] as Array<Record<string, unknown>>;

  for (const persona of DEBATE_PERSONAS) {
    const prompt = [
      `You are ${persona.name} (${persona.role}).`,
      `Debate topic: ${topic}`,
      `Respond in ${languageName} (${languageCode}).`,
      "Provide one clear perspective with practical reasoning in 3-6 sentences.",
    ].join("\n");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      const res = await fetch(`${upstream}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, query: prompt, language: languageCode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        responses.push({
          persona: persona.id,
          name: persona.name,
          emoji: persona.emoji,
          role: persona.role,
          response: `Service returned ${res.status}`,
          status: "error",
          tokens: 0,
        });
        continue;
      }

      const text = await res.text();
      let answer = "";
      try {
        answer = extractChatText(JSON.parse(text));
      } catch {
        answer = text.trim();
      }

      responses.push({
        persona: persona.id,
        name: persona.name,
        emoji: persona.emoji,
        role: persona.role,
        response: answer || "No response",
        status: "success",
        tokens: (answer || "").split(/\s+/).filter(Boolean).length,
      });
    } catch (error) {
      responses.push({
        persona: persona.id,
        name: persona.name,
        emoji: persona.emoji,
        role: persona.role,
        response: error instanceof Error ? error.message : "Chat fallback failed",
        status: "error",
        tokens: 0,
      });
    }
  }

  return responses;
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

    const preferredLanguageRaw = String(body.preferred_language || "")
      .trim()
      .toLowerCase();
    const preferredLanguage = preferredLanguageRaw || detectLanguageHint(topic);

    const payload = {
      ...body,
      topic,
      preferred_language: preferredLanguage,
      language_name:
        body.language_name ||
        LANGUAGE_NAMES[preferredLanguage] ||
        preferredLanguage.toUpperCase(),
      quality_profile: body.quality_profile || "high",
      language_layers:
        typeof body.language_layers === "number" ? body.language_layers : 4,
    };

    let lastError = "No upstream candidates configured";
    const candidates = buildCandidates();

    for (const upstream of candidates) {
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

    for (const upstream of candidates) {
      try {
        const responses = await callChatFallback(
          upstream,
          topic,
          preferredLanguage,
          LANGUAGE_NAMES[preferredLanguage] || preferredLanguage.toUpperCase(),
        );

        if (responses.length > 0) {
          return NextResponse.json({
            topic,
            responses,
            language: preferredLanguage,
            engine: "chat-fallback",
          });
        }
      } catch {
        // continue
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
