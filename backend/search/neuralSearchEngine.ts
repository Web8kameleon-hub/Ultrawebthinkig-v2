/**
 * Neural Search Engine - Real Implementation
 * Uses Ollama for local LLM search + free APIs for real data
 */

export interface NeuralSearchResult {
  id: string;
  title: string;
  url: string;
  description: string;
  relevanceScore: number;
  neuralScore: number;
  category: 'web' | 'neural' | 'agi' | 'technical' | 'documentation';
  timestamp: Date;
  source: 'ollama' | 'free-api' | 'local-cache' | 'documentation';
  metadata: {
    keywords: string[];
    semanticTags: string[];
    contextScore: number;
    agiRelevance: number;
  };
}

export interface NeuralContext {
  intent: 'search' | 'learn' | 'code' | 'analyze' | 'create';
  depth: 'surface' | 'deep' | 'neural' | 'agi';
  userContext?: {
    previousQueries?: string[];
    preferences?: string[];
    expertise?: string;
  };
}

class NeuralSearchEngine {
  private queryCache: Map<string, NeuralSearchResult[]> = new Map();
  private stats = { totalQueries: 0, cacheSize: 0, avgResponseTime: 0 };
  private ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  async searchNeural(query: string, context?: Partial<NeuralContext>): Promise<NeuralSearchResult[]> {
    try {
      const cacheKey = `${query}_${context?.depth || 'surface'}`;
      if (this.queryCache.has(cacheKey)) return this.queryCache.get(cacheKey) || [];

      this.stats.totalQueries++;

      const [ollamaResults, freeApiResults, docResults] = await Promise.all([
        this.searchWithOllama(query, context).catch(() => []),
        this.searchWithFreeAPIs(query).catch(() => []),
        this.searchDocumentation(query).catch(() => [])
      ]);

      const depthLimits: Record<string, number> = { surface: 5, deep: 15, neural: 30, agi: 50 };
      let results = this.mergeAndRankResults([...ollamaResults, ...freeApiResults, ...docResults], query)
        .slice(0, depthLimits[context?.depth || 'surface']);

      this.queryCache.set(cacheKey, results);
      this.stats.cacheSize = this.queryCache.size;
      return results;
    } catch (error) {
      console.error('Neural search error:', error);
      return this.getDocumentationFallback(query);
    }
  }

  private async searchWithOllama(query: string, context?: Partial<NeuralContext>): Promise<NeuralSearchResult[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'neural-search',
          prompt: `Search for: ${query}\nContext: ${JSON.stringify(context)}\nProvide results as JSON array with title, description, url, relevance`,
          stream: false
        })
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (!data.response) return [];
      try {
        const parsed = JSON.parse(data.response);
        return Array.isArray(parsed) ? parsed.map((r: any) => ({
          id: `ollama_${Math.random()}`,
          title: r.title || '',
          url: r.url || '#',
          description: r.description || '',
          relevanceScore: (r.relevance || 0) * 100,
          neuralScore: 85,
          category: 'neural' as const,
          timestamp: new Date(),
          source: 'ollama' as const,
          metadata: { keywords: (r.keywords || []).slice(0, 5), semanticTags: [], contextScore: 80, agiRelevance: context?.depth === 'agi' ? 90 : 60 }
        })) : [];
      } catch { return []; }
    } catch { return []; }
  }

  private async searchWithFreeAPIs(query: string): Promise<NeuralSearchResult[]> {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
      const response = await fetch(ddgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) return [];
      const data = await response.json();
      const results: NeuralSearchResult[] = [];
      if (data.Results && Array.isArray(data.Results)) {
        results.push(...data.Results.slice(0, 5).map((r: any, idx: number) => ({
          id: `ddg_${idx}`, title: r.Title || '', url: r.FirstURL || '#', description: r.Text || '',
          relevanceScore: 75 - idx * 5, neuralScore: 70, category: 'web' as const, timestamp: new Date(),
          source: 'free-api' as const, metadata: { keywords: this.extractKeywords(r.Title + ' ' + r.Text), semanticTags: [], contextScore: 75, agiRelevance: 50 }
        })));
      }
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        results.push(...data.RelatedTopics.slice(0, 3).map((t: any, idx: number) => ({
          id: `ddg_r_${idx}`, title: t.Text || '', url: t.FirstURL || '#', description: '',
          relevanceScore: 60, neuralScore: 65, category: 'web' as const, timestamp: new Date(),
          source: 'free-api' as const, metadata: { keywords: [], semanticTags: [], contextScore: 70, agiRelevance: 45 }
        })));
      }
      return results;
    } catch { return []; }
  }

  private async searchDocumentation(query: string): Promise<NeuralSearchResult[]> {
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`,
        { headers: { 'User-Agent': 'Ultrawebthing' } }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return (data.items || []).map((repo: any) => ({
        id: `github_${repo.id}`, title: repo.full_name, url: repo.html_url,
        description: repo.description || '', relevanceScore: Math.min(100, (repo.stargazers_count / 100) * 100),
        neuralScore: Math.min(100, (repo.stargazers_count / 1000) * 100), category: 'documentation' as const,
        timestamp: new Date(repo.updated_at), source: 'free-api' as const,
        metadata: { keywords: repo.topics || [], semanticTags: [repo.language || ''].filter(Boolean), contextScore: 80, agiRelevance: repo.topics?.includes('ai') ? 90 : 50 }
      }));
    } catch { return []; }
  }

  private mergeAndRankResults(results: NeuralSearchResult[], query: string): NeuralSearchResult[] {
    const seen = new Set<string>();
    return results
      .filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true; })
      .map(r => ({ ...r, relevanceScore: this.calculateRelevance(r, query), neuralScore: this.calculateNeuralScore(r) }))
      .sort((a, b) => (b.relevanceScore * 0.6 + b.neuralScore * 0.4) - (a.relevanceScore * 0.6 + a.neuralScore * 0.4));
  }

  private calculateRelevance(result: NeuralSearchResult, query: string): number {
    const q = query.toLowerCase();
    return Math.min(100,
      (result.title.toLowerCase().includes(q) ? 40 : 0) +
      (result.description.toLowerCase().includes(q) ? 20 : 0) +
      (result.metadata.keywords.some(k => q.includes(k.toLowerCase())) ? 30 : 0) +
      result.relevanceScore * 0.1
    );
  }

  private calculateNeuralScore(result: NeuralSearchResult): number {
    let score = result.neuralScore || 60;
    if (result.source === 'ollama') score += 15;
    if (result.source === 'documentation') score += 10;
    if (result.metadata.semanticTags.length > 0) score += 10;
    return Math.min(100, score);
  }

  private extractKeywords(text: string): string[] {
    if (!text) return [];
    return text.split(/\s+/).filter(w => w.length > 3).slice(0, 5).map(w => w.toLowerCase());
  }

  private getDocumentationFallback(query: string): NeuralSearchResult[] {
    return [
      { id: 'fb_1', title: 'API Gateway', url: '/api/gateway', description: 'Central hub for all API endpoints', relevanceScore: 70, neuralScore: 65, category: 'documentation', timestamp: new Date(), source: 'local-cache', metadata: { keywords: ['api', 'gateway'], semanticTags: ['backend'], contextScore: 75, agiRelevance: 60 } }
    ];
  }

  searchSuggestions(query: string): string[] {
    if (query.length < 2) return [];
    return [`${query} api`, `${query} guide`, `${query} examples`, `how to use ${query}`];
  }

  clearNeuralCache(): void { this.queryCache.clear(); this.stats.cacheSize = 0; }
  clearQueryHistory(): void {}

  getSearchStats() {
    return { totalQueries: this.stats.totalQueries, cacheSize: this.stats.cacheSize };
  }
}

export const neuralSearchEngine = new NeuralSearchEngine();
