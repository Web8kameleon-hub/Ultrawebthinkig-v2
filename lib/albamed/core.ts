import { AlbaMedProviderResult } from './types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const CLISONIX_URL = process.env.CLISONIX_URL;
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
    const failures: string[] = [];

    if (!useCloud) {
      try {
        return await this.requestOllama(systemPrompt, userMessage);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'Ollama request failed');
      }
    }

    try {
      return await this.requestClisonix(systemPrompt, userMessage, language);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'Clisonix Ocean request failed');
    }

    throw new Error(`No real AlbaMed AI provider is available: ${failures.join('; ')}`);
  }

  private async requestOllama(systemPrompt: string, userMessage: string): Promise<AlbaMedProviderResult> {
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

    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const data = await response.json();
    const text = typeof data?.message?.content === 'string' ? data.message.content.trim() : '';
    if (!text) throw new Error('Ollama returned an empty response');
    return {
      text,
      source: 'ollama',
      confidence: typeof data?.confidence === 'number' ? data.confidence : 0,
      tokens: typeof data?.eval_count === 'number' ? data.eval_count : undefined,
    };
  }

  private async requestClisonix(
    systemPrompt: string,
    userMessage: string,
    language: 'sq' | 'en' | 'mixed'
  ): Promise<AlbaMedProviderResult> {
    if (!CLISONIX_URL) throw new Error('CLISONIX_URL is not configured');

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

    if (!response.ok) throw new Error(`Clisonix Ocean returned HTTP ${response.status}`);
    const data = await response.json();
    const text =
        (typeof data?.response === 'string' && data.response.trim()) ||
        (typeof data?.message === 'string' && data.message.trim()) ||
        (typeof data?.choices?.[0]?.message?.content === 'string' && data.choices[0].message.content.trim()) ||
        '';

    if (!text) throw new Error('Clisonix Ocean returned an empty response');
    return {
      text,
      source: 'clisonix',
      confidence: typeof data?.confidence === 'number' ? data.confidence : 0,
      tokens: typeof data?.tokens === 'number' ? data.tokens : undefined,
    };
  }
}

export const albaMedCore = new AlbaMedCore();
