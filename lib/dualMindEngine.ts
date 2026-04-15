/**
 * DualMind Engine — ALBI & JONA
 *
 * Dy personalitete AI të ndara që punojnë në paralel duke thirrur
 * Ollama lokal (llama3.1:8b). Nëse Ollama nuk është disponibël,
 * bien back te Clisonix internal network.
 *
 * ALBI  — analistik, teknik, i drejtpërdrejtë
 * JONA  — kreativ, empatik, i orientuar drejt njerëzve
 *
 * @author Ledjan Ahmati
 * @version 8.0.0-WEB8
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const CLISONIX_URL = process.env.CLISONIX_URL ?? 'https://api.clisonix.com/api/ocean';
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b';
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT ?? '50000');
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? '0');

function resolveClisonixOceanUrl(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  if (normalized.endsWith('/api/ocean')) {
    return normalized;
  }
  return `${normalized}/api/ocean`;
}

function buildRequestSignal(): AbortSignal | undefined {
  if (!AI_REQUEST_TIMEOUT_MS || AI_REQUEST_TIMEOUT_MS <= 0) {
    return undefined;
  }
  return AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS);
}

export interface DualConversation {
  albiResponse: string;
  jonaResponse: string;
  sharedInsight: string;
  language: string;
  confidence: number;
  source: 'ollama' | 'clisonix' | 'internal';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function callOllama(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: buildRequestSignal(),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: {
        num_predict: OLLAMA_NUM_PREDICT,
        temperature: 0.6,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return (data.message?.content as string) ?? '';
}

async function callClisonix(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(resolveClisonixOceanUrl(CLISONIX_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: buildRequestSignal(),
    body: JSON.stringify({
      model: 'ocean-core',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Clisonix HTTP ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content as string) ??
         (data.message?.content as string) ?? '';
}

async function generate(systemPrompt: string, userMessage: string): Promise<{ text: string; source: 'ollama' | 'clisonix' | 'internal' }> {
  try {
    const text = await callOllama(systemPrompt, userMessage);
    return { text, source: 'ollama' };
  } catch {
    try {
      const text = await callClisonix(systemPrompt, userMessage);
      return { text, source: 'clisonix' };
    } catch {
      return { text: '', source: 'internal' };
    }
  }
}

// ─── Personalitete ──────────────────────────────────────────────────────────

const ALBI_SYSTEM = `Ti je ALBI — inteligjenca analitike e OpenMind.
Karakteri yt: i drejtpërdrejtë, teknik, preciz dhe i orientuar drejt fakteve.
Jep përgjigje strukturuara me pika dhe analiza konkrete. Mos filozofo shumë.
Gjuha e parapëlqyer: shqip, por përshtatesh me gjuhën e pyetjes.`;

const JONA_SYSTEM = `Ti je JONA — inteligjenca empatike dhe kreative e OpenMind.
Karakteri yt: i ngrohtë, kreativ, inkurajues dhe i orientuar drejt njerëzve.
Jep përgjigje narrative, me metafora dhe frymëzim. Krijo lidhje emocionale.
Gjuha e parapëlqyer: shqip, por përshtatesh me gjuhën e pyetjes.`;

const SHARED_SYSTEM = `Ti je sinteza e ALBI dhe JONA — dy perspektiva të OpenMind.
Shkruaj një "insight" të përbashkët të shkurtër (2-3 fjali) që bashkon analizën teknike me kuptimin human.
Mos përsërit çfarë kanë thënë tashmë; shto diçka të re dhe unifikuese.`;

// ─── DualMindEngine ─────────────────────────────────────────────────────────

export class DualMindEngine {
  private static instance: DualMindEngine;

  private constructor() {}

  static getInstance(): DualMindEngine {
    if (!DualMindEngine.instance) {
      DualMindEngine.instance = new DualMindEngine();
    }
    return DualMindEngine.instance;
  }

  /**
   * Gjeneron bisedë paralele nga ALBI dhe JONA duke thirrur Ollama
   * dhe kombinon me një "shared insight".
   */
  async generateAnthropicConversation(
    query: string,
    language = 'sq'
  ): Promise<DualConversation> {
    const userMsg = language !== 'sq'
      ? `[Respond in language: ${language}]\n${query}`
      : query;

    // Thirrje paralele për të dy personalitetet
    const [albiResult, jonaResult] = await Promise.all([
      generate(ALBI_SYSTEM, userMsg),
      generate(JONA_SYSTEM, userMsg),
    ]);

    // Nëse njëri ka përgjigje, gjeneroj insight-in e përbashkët
    let sharedInsight = '';
    const source = albiResult.source === 'internal' ? jonaResult.source : albiResult.source;

    if (albiResult.text || jonaResult.text) {
      const sharedContext = `Pyetja origjinale: "${query}"
ALBI tha: ${albiResult.text || '(pa përgjigje)'}
JONA tha: ${jonaResult.text || '(pa përgjigje)'}`;
      const sharedResult = await generate(SHARED_SYSTEM, sharedContext);
      sharedInsight = sharedResult.text;
    }

    // Nëse asnjëri nuk ka përgjigje, fallback internal
    const fallback = 'no data';

    return {
      albiResponse: albiResult.text || '',
      jonaResponse: jonaResult.text || '',
      sharedInsight: sharedInsight || fallback,
      language,
      confidence: albiResult.text && jonaResult.text ? 0.92
                : albiResult.text || jonaResult.text ? 0.70
                : 0,
      source: (albiResult.text || jonaResult.text) ? (source === 'internal' ? 'internal' : source) : 'internal',
    };
  }
}

export default DualMindEngine;
