import { AlbaMedProviderResult } from './types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const CLISONIX_URL = process.env.CLISONIX_URL || process.env.NEXT_PUBLIC_CLISONIX_URL || 'https://clisonix.com';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || '50000');
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || '0');

function resolveClisonixOceanUrl(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  if (normalized.endsWith('/api/ocean')) return normalized;
  return `${normalized}/api/ocean`;
}

function buildSignal(): AbortSignal | undefined {
  if (!AI_REQUEST_TIMEOUT_MS || AI_REQUEST_TIMEOUT_MS <= 0) return undefined;
  return AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS);
}

export class AlbaMedCore {
  async request(
    systemPrompt: string,
    userMessage: string,
    language: 'sq' | 'en' | 'mixed',
    useCloud = false
  ): Promise<AlbaMedProviderResult> {
    if (!useCloud) {
      const ollama = await this.tryOllama(systemPrompt, userMessage);
      if (ollama.source !== 'none') return ollama;
    }

    const clisonix = await this.tryClisonix(systemPrompt, userMessage, language);
    if (clisonix.source !== 'none') return clisonix;

    return { text: 'no data', source: 'none', confidence: 0 };
  }

  private async tryOllama(systemPrompt: string, userMessage: string): Promise<AlbaMedProviderResult> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: buildSignal(),
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          options: {
            num_predict: OLLAMA_NUM_PREDICT,
            temperature: 0.4,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) return { text: 'no data', source: 'none', confidence: 0 };
      const data = await response.json();
      const text = typeof data?.message?.content === 'string' ? data.message.content.trim() : '';
      if (!text) return { text: 'no data', source: 'none', confidence: 0 };
      return {
        text,
        source: 'ollama',
        confidence: 0.95,
        tokens: typeof data?.eval_count === 'number' ? data.eval_count : undefined,
      };
    } catch {
      return { text: 'no data', source: 'none', confidence: 0 };
    }
  }

  private async tryClisonix(
    systemPrompt: string,
    userMessage: string,
    language: 'sq' | 'en' | 'mixed'
  ): Promise<AlbaMedProviderResult> {
    try {
      const response = await fetch(resolveClisonixOceanUrl(CLISONIX_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: buildSignal(),
        body: JSON.stringify({
          model: 'ocean-core',
          language,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) return { text: 'no data', source: 'none', confidence: 0 };
      const data = await response.json();
      const text =
        (typeof data?.response === 'string' && data.response.trim()) ||
        (typeof data?.message === 'string' && data.message.trim()) ||
        (typeof data?.choices?.[0]?.message?.content === 'string' && data.choices[0].message.content.trim()) ||
        '';

      if (!text) return { text: 'no data', source: 'none', confidence: 0 };
      return { text, source: 'clisonix', confidence: 0.85 };
    } catch {
      return { text: 'no data', source: 'none', confidence: 0 };
    }
  }
}

export const albaMedCore = new AlbaMedCore();
