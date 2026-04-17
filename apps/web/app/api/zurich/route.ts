import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const PRIMARY_OCEAN_URL = process.env.OCEAN_INTERNAL_URL || process.env.OCEAN_CORE_URL;
const INTERNAL_OCEAN_URL = "http://clisonix-ocean-core:8030";
const LOCAL_OCEAN_URL = "http://localhost:8030";

type ZurichDeterministicResponse = {
  ok: boolean;
  input: string;
  output: string;
  confidence: number;
  strategy: string;
  domains: string[];
  processing_time_ms: number;
  engine: string;
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

function normalizeIndexes(input: string): string {
  const normalizedSubscripts = input.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => SUBSCRIPT_DIGITS[d] || d);
  return normalizedSubscripts.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => SUPERSCRIPT_DIGITS[d] || d);
}

function parseKnownStates(prompt: string): Map<number, number> {
  const stateRegex = /S\s*\(?\s*([0-9]+)\s*\)?\s*[=:]\s*(-?\d+)/gi;
  const states = new Map<number, number>();
  for (const match of prompt.matchAll(stateRegex)) {
    states.set(Number(match[1]), Number(match[2]));
  }
  return states;
}

function getConsecutiveFromZero(states: Map<number, number>): number[] | null {
  if (states.size < 3) return null;
  if (!states.has(0)) return null;

  const maxKnown = Math.max(...Array.from(states.keys()));
  const values: number[] = [];
  for (let n = 0; n <= maxKnown; n += 1) {
    const v = states.get(n);
    if (typeof v !== "number") return null;
    values.push(v);
  }
  return values;
}

function detectTargetN(prompt: string, maxKnownIndex: number): number {
  const askMatch = prompt.match(/(?:compute|find|determine|calculate)\s+S\s*\(?\s*([0-9]+)\s*\)?/i);
  const allMentions = Array.from(prompt.matchAll(/S\s*\(?\s*([0-9]+)\s*\)?/gi)).map((m) => Number(m[1]));

  if (askMatch) {
    return Number(askMatch[1]);
  }
  if (allMentions.length > 0) {
    return Math.max(...allMentions);
  }
  return maxKnownIndex;
}

function maybeSolveDeterministicSequence(prompt: string): ZurichDeterministicResponse | null {
  const started = performance.now();
  const normalizedPrompt = normalizeIndexes(prompt);

  const states = parseKnownStates(normalizedPrompt);
  const series = getConsecutiveFromZero(states);

  if (!series || series.length < 3) return null;

  const maxKnownIndex = series.length - 1;
  const targetN = detectTargetN(normalizedPrompt, maxKnownIndex);
  if (!Number.isFinite(targetN) || targetN < 0) return null;

  // 1) Arithmetic progression: S_n = S_0 + n*d
  {
    const d = series[1] - series[0];
    let arithmeticMatches = true;
    for (let n = 0; n < series.length; n += 1) {
      if (series[n] !== series[0] + n * d) {
        arithmeticMatches = false;
        break;
      }
    }

    if (arithmeticMatches) {
      const value = series[0] + targetN * d;
      const output = [
        "Deterministic sequence detected.",
        `Recurrence rule: S_n = S_(n-1) + ${d}`,
        `Closed form: S_n = ${series[0]} + ${d}*n`,
        `Requested value: S_${targetN} = ${value}`,
      ].join("\n");

      return {
        ok: true,
        input: prompt,
        output,
        confidence: 1,
        strategy: "deterministic-sequence-proof",
        domains: ["mathematics", "deterministic-reasoning"],
        processing_time_ms: Number((performance.now() - started).toFixed(3)),
        engine: "Zurich Deterministic Engine v1.2",
      };
    }
  }

  // 2) First-order linear recurrence: S_n = a*S_(n-1) + b
  {
    const s0 = series[0];
    const s1 = series[1];
    const s2 = series[2];

    if (s1 !== s0) {
      const a = (s2 - s1) / (s1 - s0);
      const b = s1 - a * s0;

      if (Number.isFinite(a) && Number.isFinite(b)) {
        let firstOrderMatches = true;
        for (let n = 1; n < series.length; n += 1) {
          const predicted = a * series[n - 1] + b;
          if (Math.abs(predicted - series[n]) > 1e-9) {
            firstOrderMatches = false;
            break;
          }
        }

        if (firstOrderMatches) {
          let current = series[0];
          for (let i = 1; i <= targetN; i += 1) {
            current = a * current + b;
          }

          const currentRounded = Math.round(current);
          const isIntegerModel = Number.isInteger(a) && Number.isInteger(b);

          const plusOne = s0 + 1;
          const c = plusOne > 0 ? Math.log2(plusOne) : NaN;
          const hasPowerClosedForm = Number.isInteger(c) && Math.abs(b - 1) < 1e-9 && Math.abs(a - 2) < 1e-9;
          const closedForm = hasPowerClosedForm
            ? `S_n = 2^(n+${c}) - 1`
            : `S_n = ${a}^n * ${s0} + ${b} * (${a}^n - 1)/(${a} - 1)`;

          const output = [
            "Deterministic sequence detected.",
            `Recurrence rule: S_n = ${isIntegerModel ? `${a}*S_(n-1) + ${b}` : `${a}*S_(n-1) + ${b}`}`,
            `Closed form: ${closedForm}`,
            `Requested value: S_${targetN} = ${currentRounded}`,
          ].join("\n");

          return {
            ok: true,
            input: prompt,
            output,
            confidence: 1,
            strategy: "deterministic-sequence-proof",
            domains: ["mathematics", "deterministic-reasoning"],
            processing_time_ms: Number((performance.now() - started).toFixed(3)),
            engine: "Zurich Deterministic Engine v1.2",
          };
        }
      }
    }
  }

  // 3) Second-order linear recurrence: S_n = p*S_(n-1) + q*S_(n-2)
  if (series.length >= 4) {
    const s0 = series[0];
    const s1 = series[1];
    const s2 = series[2];
    const s3 = series[3];

    const det = s1 * s1 - s0 * s2;
    if (Math.abs(det) > 1e-12) {
      const p = (s2 * s1 - s0 * s3) / det;
      const q = (s1 * s3 - s2 * s2) / det;

      if (Number.isFinite(p) && Number.isFinite(q)) {
        let secondOrderMatches = true;
        for (let n = 2; n < series.length; n += 1) {
          const predicted = p * series[n - 1] + q * series[n - 2];
          if (Math.abs(predicted - series[n]) > 1e-9) {
            secondOrderMatches = false;
            break;
          }
        }

        if (secondOrderMatches) {
          let values = [...series];
          for (let n = values.length; n <= targetN; n += 1) {
            values.push(p * values[n - 1] + q * values[n - 2]);
          }
          const requestedValue = values[targetN] ?? series[targetN];
          const roundedValue = Math.round(requestedValue);

          const output = [
            "Deterministic sequence detected.",
            `Recurrence rule: S_n = ${p}*S_(n-1) + ${q}*S_(n-2)`,
            "Closed form: second-order linear recurrence (characteristic polynomial method).",
            `Requested value: S_${targetN} = ${roundedValue}`,
          ].join("\n");

          return {
            ok: true,
            input: prompt,
            output,
            confidence: 1,
            strategy: "deterministic-sequence-proof",
            domains: ["mathematics", "deterministic-reasoning"],
            processing_time_ms: Number((performance.now() - started).toFixed(3)),
            engine: "Zurich Deterministic Engine v1.2",
          };
        }
      }
    }
  }

  return null;
}

function buildCandidates(): string[] {
  return [PRIMARY_OCEAN_URL, INTERNAL_OCEAN_URL, isDev ? LOCAL_OCEAN_URL : undefined]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown> = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }
    }

    const prompt = String(body.prompt || body.query || body.message || "").trim();

    if (!prompt) {
      return NextResponse.json({ error: "prompt (or query/message) is required" }, { status: 400 });
    }

    const deterministic = maybeSolveDeterministicSequence(prompt);
    if (deterministic) {
      return NextResponse.json(deterministic);
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
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }

        const errorText = await res.text();
        lastError = `Zurich upstream ${upstream} returned ${res.status}: ${errorText.slice(0, 240)}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown upstream error";
      }
    }

    return NextResponse.json(
      { error: "Zurich unavailable", details: lastError, upstream_candidates: buildCandidates() },
      { status: 502 },
    );
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
