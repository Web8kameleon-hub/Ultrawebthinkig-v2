/**
 * UltraWebThinking Chat API - Internal AI Backend
 * Primary: Ollama local models (llama3.1 / llava)
 * Secondary: Clisonix internal network endpoints
 * 
 * NO MOCK DATA - REAL AI RESPONSES ONLY
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const CLISONIX_URL = process.env.CLISONIX_URL || process.env.NEXT_PUBLIC_CLISONIX_URL || 'https://api.clisonix.com';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || '50000');
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || '0');

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

interface ChatRequest {
  message: string;
  mode?: 'general' | 'focused' | 'research' | 'brainstorm';
  personality?: 'assistant' | 'philosopher' | 'scientist' | 'creative';
  context?: string[];
  language?: string;
  useCloud?: boolean; // Force use Clisonix internal network
  chunkSize?: number;
  stream?: boolean;
}

interface ChatResponse {
  response: string;
  model: string;
  source: 'ollama' | 'clisonix' | 'fallback';
  thinking_time: number;
  metadata?: {
    tokens?: number;
    confidence?: number;
    language?: string;
    chunkCount?: number;
  };
}

function splitMessageIntoChunks(message: string, maxChunkSize: number): string[] {
  const text = message.trim();
  if (text.length <= maxChunkSize) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      if (sentence.length <= maxChunkSize) {
        current = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxChunkSize) {
          chunks.push(sentence.slice(i, i + maxChunkSize));
        }
      }
      continue;
    }

    const candidate = `${current} ${sentence}`;
    if (candidate.length <= maxChunkSize) {
      current = candidate;
    } else {
      chunks.push(current);
      if (sentence.length <= maxChunkSize) {
        current = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxChunkSize) {
          chunks.push(sentence.slice(i, i + maxChunkSize));
        }
        current = '';
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

// System prompts based on personality
const systemPrompts: Record<string, string> = {
  assistant: `Ti je UltraWebThinking AI - një asistent i avancuar dhe i dobishëm. 
Përgjigju në mënyrë të qartë, koncize dhe të saktë. Përdor shqipen kur përdoruesi flet shqip.
Je i aftë të diskutosh çdo temë me ekspertizë dhe entuziazëm.`,

  philosopher: `Ti je një filozof i thellë që eksploron çështje të mëdha të jetës.
Analizon konceptet nga perspektiva të ndryshme, përdor logjikën dhe intuicionin.
Shpesh citon mendimtarë të mëdhenj dhe provokon mendim kritik.`,

  scientist: `Ti je një shkencëtar që bazohet në fakte, të dhëna dhe metodën shkencore.
Shpjegon koncepte komplekse në mënyrë të thjeshtë dhe të kuptueshme.
Citon hulumtime dhe zbulime të fundit shkencore.`,

  creative: `Ti je një mendimtar kreativ që sheh mundësi kudo.
Gjeneron ide të reja, bën lidhje të papritura dhe inspiron inovacion.
Përdor metafora, analogji dhe storytelling për të shprehur ide.`
};

// Mode-specific instructions
const modeInstructions: Record<string, string> = {
  general: 'Përgjigju natyrshëm dhe në mënyrë bisedore.',
  focused: 'Fokusohu në thelbin e pyetjes, jep përgjigje të drejtpërdrejtë.',
  research: 'Jep informacion të detajuar, cito burime kur mundesh.',
  brainstorm: 'Gjenero shumë ide, mos u kufizo, mendo në mënyrë të lirë.'
};

/**
 * Try Ollama local first
 */
async function tryOllama(
  message: string,
  systemMessage: string,
  context: string[],
  personality: string
): Promise<{ success: boolean; response?: string; tokens?: number }> {
  try {
    const messages = [
      { role: 'system', content: systemMessage },
      ...context.slice(-10).map((msg, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: msg
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: {
          temperature: personality === 'creative' ? 0.9 : 0.7,
          top_p: 0.9,
          num_predict: OLLAMA_NUM_PREDICT
        }
      }),
      signal: buildRequestSignal()
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      response: data.message?.content,
      tokens: data.eval_count
    };
  } catch {
    return { success: false };
  }
}

async function tryOllamaStream(
  message: string,
  systemMessage: string,
  context: string[],
  personality: string,
  onToken: (token: string) => void
): Promise<{ success: boolean; response?: string; tokens?: number }> {
  try {
    const messages = [
      { role: 'system', content: systemMessage },
      ...context.slice(-10).map((msg, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: msg
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        options: {
          temperature: personality === 'creative' ? 0.9 : 0.7,
          top_p: 0.9,
          num_predict: OLLAMA_NUM_PREDICT
        }
      }),
      signal: buildRequestSignal()
    });

    if (!response.ok || !response.body) {
      return { success: false };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let evalCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const part = JSON.parse(line) as {
            message?: { content?: string };
            eval_count?: number;
          };
          const token = part.message?.content || '';
          if (token) {
            fullResponse += token;
            onToken(token);
          }
          if (typeof part.eval_count === 'number') {
            evalCount = part.eval_count;
          }
        } catch {
          continue;
        }
      }
    }

    if (!fullResponse.trim()) {
      return { success: false };
    }

    return {
      success: true,
      response: fullResponse,
      tokens: evalCount || undefined,
    };
  } catch {
    return { success: false };
  }
}

/**
 * Fallback to Clisonix internal AI network
 */
async function tryClisonix(
  message: string,
  language: string
): Promise<{ success: boolean; response?: string }> {
  try {
    const response = await fetch(resolveClisonixOceanUrl(CLISONIX_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language }),
      signal: buildRequestSignal()
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      response: data.response || data.message
    };
  } catch {
    return { success: false };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const {
    message, 
    mode = 'general', 
    personality = 'assistant', 
    context = [],
    language = 'sq',
    useCloud = false,
    chunkSize = 320,
    stream = false,
  } = req.body as ChatRequest;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const systemMessage = `${systemPrompts[personality] || systemPrompts.assistant}\n\n${modeInstructions[mode] || modeInstructions.general}`;

  const normalizedChunkSize = Math.max(120, Math.min(1200, Number(chunkSize) || 320));
  const chunks = splitMessageIntoChunks(message, normalizedChunkSize);

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, payload: Record<string, unknown>) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let successCount = 0;
    let source: 'ollama' | 'clisonix' | 'fallback' = 'fallback';
    let tokenTotal = 0;

    sendEvent('start', { chunkCount: chunks.length, model: MODEL });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      sendEvent('chunk-start', { index: i, size: chunk.length });

      let chunkSucceeded = false;
      if (!useCloud) {
        const streamed = await tryOllamaStream(chunk, systemMessage, context, personality, (token) => {
          sendEvent('token', { index: i, token });
        });
        if (streamed.success && streamed.response) {
          successCount += 1;
          source = 'ollama';
          tokenTotal += streamed.tokens || 0;
          chunkSucceeded = true;
        }
      }

      if (!chunkSucceeded) {
        const clisonix = await tryClisonix(chunk, language);
        if (clisonix.success && clisonix.response) {
          successCount += 1;
          if (source !== 'ollama') source = 'clisonix';
          sendEvent('token', { index: i, token: clisonix.response });
          chunkSucceeded = true;
        }
      }

      if (!chunkSucceeded) {
        sendEvent('token', { index: i, token: 'no data' });
      }

      sendEvent('chunk-end', { index: i, success: chunkSucceeded });
    }

    const thinkingTime = Date.now() - startTime;
    sendEvent('done', {
      source: successCount > 0 ? source : 'fallback',
      thinking_time: thinkingTime,
      metadata: {
        tokens: tokenTotal || undefined,
        confidence: successCount > 0 ? Math.min(0.95, successCount / chunks.length) : 0,
        language,
        chunkCount: chunks.length,
      }
    });
    res.end();
    return;
  }

  const resolveChunk = async (chunk: string): Promise<{ response: string; source: 'ollama' | 'clisonix' | 'fallback'; tokens?: number }> => {
    let result: { response: string; source: 'ollama' | 'clisonix' | 'fallback'; tokens?: number } | null = null;

    const clisonixPromise = tryClisonix(chunk, language);

    if (!useCloud) {
      const ollamaResult = await tryOllama(chunk, systemMessage, context, personality);
      if (ollamaResult.success && ollamaResult.response) {
        result = {
          response: ollamaResult.response,
          source: 'ollama',
          tokens: ollamaResult.tokens
        };
      }
    }

    if (!result) {
      const clisonixResult = await clisonixPromise;
      if (clisonixResult.success && clisonixResult.response) {
        result = {
          response: clisonixResult.response,
          source: 'clisonix'
        };
      }
    }

    if (!result) {
      return {
        response: 'no data',
        source: 'fallback'
      };
    }

    return result;
  };

  const chunkResults = await Promise.all(chunks.map((chunk) => resolveChunk(chunk)));
  const successful = chunkResults.filter((item) => item.source !== 'fallback' && item.response && item.response !== 'no data');

  const result: { response: string; source: 'ollama' | 'clisonix' | 'fallback'; tokens?: number } =
    successful.length === 0
      ? { response: 'no data', source: 'fallback' }
      : {
          response: successful.map((item) => item.response).join('\n\n'),
          source: successful.some((item) => item.source === 'ollama') ? 'ollama' : 'clisonix',
          tokens: successful.reduce((sum, item) => sum + (item.tokens || 0), 0) || undefined,
        };

  const thinkingTime = Date.now() - startTime;

  return res.status(200).json({
    response: result.response,
    model: result.source === 'ollama' ? MODEL : result.source === 'clisonix' ? 'clisonix-internal' : 'internal-fallback',
    source: result.source,
    thinking_time: thinkingTime,
    metadata: {
      tokens: result.tokens,
      confidence: successful.length > 0 ? Math.min(0.95, successful.length / chunks.length) : 0,
      language,
      chunkCount: chunks.length,
    }
  });
}
