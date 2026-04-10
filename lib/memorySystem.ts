/**
 * OpenMind Memory System
 * In-process document & conversation store used by /api/memory and /api/openmind.
 *
 * @author Ledjan Ahmati
 * @version 8.0.0-WEB8
 */

export interface MemoryEntry {
  id: string;
  title: string;
  type: 'document' | 'conversation' | 'snippet';
  content: string;
  fragments: string[];
  metadata: {
    timestamp: number;
    size?: number;
    mimeType?: string;
    confidence?: number;
    responseTime?: number;
    servicesUsed?: number;
  };
}

export interface SearchResult {
  entry: MemoryEntry;
  relevanceScore: number;
  matchedFragments: string[];
}

export interface MemoryStats {
  totalEntries: number;
  documents: number;
  conversations: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export class OpenMindMemory {
  private static instance: OpenMindMemory;
  private entries: MemoryEntry[] = [];

  private constructor() {}

  static getInstance(): OpenMindMemory {
    if (!OpenMindMemory.instance) {
      OpenMindMemory.instance = new OpenMindMemory();
    }
    return OpenMindMemory.instance;
  }

  async storeDocument(file: File): Promise<string> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const text = await file.text().catch(() => '');
    const fragments = text.split(/\n+/).filter(Boolean).slice(0, 20);

    this.entries.push({
      id,
      title: file.name,
      type: 'document',
      content: text,
      fragments,
      metadata: {
        timestamp: Date.now(),
        size: file.size,
        mimeType: file.type,
      },
    });

    return id;
  }

  async storeConversation(
    query: string,
    response: string,
    meta: { confidence?: number; responseTime?: number; servicesUsed?: number }
  ): Promise<string> {
    const id = `conv_${Date.now()}`;
    this.entries.push({
      id,
      title: query.substring(0, 80),
      type: 'conversation',
      content: response,
      fragments: [query, response].filter(Boolean).slice(0, 4),
      metadata: {
        timestamp: Date.now(),
        confidence: meta.confidence,
        responseTime: meta.responseTime,
        servicesUsed: meta.servicesUsed,
      },
    });
    return id;
  }

  search(query: string, limit = 10): SearchResult[] {
    const lower = query.toLowerCase();
    return this.entries
      .map((entry) => {
        const haystack = `${entry.title} ${entry.content}`.toLowerCase();
        const words = lower.split(/\s+/).filter(Boolean);
        const matchCount = words.filter((w) => haystack.includes(w)).length;
        const relevanceScore = words.length > 0 ? matchCount / words.length : 0;
        const matchedFragments = entry.fragments.filter((f) =>
          words.some((w) => f.toLowerCase().includes(w))
        );
        return { entry, relevanceScore, matchedFragments };
      })
      .filter((r) => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  getMemoryStats(): MemoryStats {
    const timestamps = this.entries.map((e) => e.metadata.timestamp);
    return {
      totalEntries: this.entries.length,
      documents: this.entries.filter((e) => e.type === 'document').length,
      conversations: this.entries.filter((e) => e.type === 'conversation').length,
      totalSize: this.entries.reduce((acc, e) => acc + (e.metadata.size ?? e.content.length), 0),
      oldestEntry: timestamps.length ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length ? Math.max(...timestamps) : null,
    };
  }
}

export default OpenMindMemory;
