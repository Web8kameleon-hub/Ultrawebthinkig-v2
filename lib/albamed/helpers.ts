import { AlbaMedAgentResult, AlbaMedSearchHit, AlbaMedSource } from './types';
import { rankByAlgebraAlphabet } from '../runtime/algebraAlphabet';

type SearchSource = {
  id: string;
  label: string;
  url: string;
  method?: 'GET' | 'POST';
  buildBody?: (query: string) => Record<string, unknown>;
};

function buildSearchSources(): SearchSource[] {
  const configured = process.env.MEDICAL_EVIDENCE_API_URL?.trim();
  if (!configured) return [];
  return [{
    id: 'medical-evidence',
    label: 'Configured Medical Evidence API',
    url: configured,
    method: 'POST',
    buildBody: (query) => ({ query }),
  }];
}

export function normalizeLanguage(language?: string): 'sq' | 'en' | 'mixed' {
  if (!language) return 'sq';
  const value = language.toLowerCase();
  if (value === 'en') return 'en';
  if (value === 'mixed') return 'mixed';
  return 'sq';
}

export function splitIntoChunks(message: string, maxChunkSize = 320): string[] {
  const text = message.trim();
  if (!text) return [];
  if (text.length <= maxChunkSize) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChunkSize) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    current = '';

    if (sentence.length <= maxChunkSize) {
      current = sentence;
      continue;
    }

    for (let index = 0; index < sentence.length; index += maxChunkSize) {
      chunks.push(sentence.slice(index, index + maxChunkSize));
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

export function pickBestSource(sources: AlbaMedSource[]): AlbaMedSource {
  if (sources.includes('ollama')) return 'ollama';
  if (sources.includes('clisonix')) return 'clisonix';
  return 'none';
}

export function aggregateConfidence(results: AlbaMedAgentResult[]): number {
  if (results.length === 0) return 0;
  return Math.min(
    1,
    results.reduce((accumulator, current) => accumulator + current.confidence, 0) / results.length
  );
}

export async function searchEverywherePossible(query: string): Promise<AlbaMedSearchHit[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const sources = buildSearchSources();
  const hits = await Promise.all(
    sources.map(async (source): Promise<AlbaMedSearchHit | null> => {
      const started = Date.now();
      try {
        const response = await fetch(source.url, {
          method: source.method || 'GET',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: source.method === 'POST' ? JSON.stringify(source.buildBody?.(normalized) || { message: normalized }) : undefined,
          signal: AbortSignal.timeout(8000),
          cache: 'no-store',
        });

        if (!response.ok) return null;
        const payload = await response.json();

        const contentCandidate =
          (typeof payload?.response === 'string' && payload.response) ||
          (typeof payload?.message === 'string' && payload.message) ||
          (payload?.data ? JSON.stringify(payload.data).slice(0, 1200) : '');

        const content = (contentCandidate || '').trim();
        if (!content || content === 'no data') return null;

        return {
          sourceId: source.id,
          sourceLabel: source.label,
          content,
          confidence: typeof payload?.metadata?.confidence === 'number' ? payload.metadata.confidence : 0.55,
          latencyMs: Date.now() - started,
        };
      } catch {
        return null;
      }
    })
  );

  const normalizedHits = hits.filter((hit): hit is AlbaMedSearchHit => !!hit);

  const ranked = rankByAlgebraAlphabet(
    normalized,
    normalizedHits.map((hit) => ({
      id: hit.sourceId,
      text: `${hit.sourceLabel} ${hit.content}`,
      payload: hit,
    })),
    10
  );

  const rankedIds = new Map(ranked.map((item, index) => [item.id, { score: item.score, index }]));

  return normalizedHits
    .map((hit) => {
      const meta = rankedIds.get(hit.sourceId);
      return {
        ...hit,
        confidence: Math.min(1, hit.confidence * 0.6 + (meta?.score || 0) * 0.4),
        __rank: meta?.index ?? Number.MAX_SAFE_INTEGER,
      } as AlbaMedSearchHit & { __rank: number };
    })
    .sort((left, right) => left.__rank - right.__rank || right.confidence - left.confidence || left.latencyMs - right.latencyMs)
    .map(({ __rank, ...hit }) => hit);
}
