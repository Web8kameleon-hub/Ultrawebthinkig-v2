'use client';

import React, { useState } from 'react';

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchComponentProps {
  className?: string;
}

const WebSearchComponent: React.FC<WebSearchComponentProps> = ({ className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/web-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'search',
          data: { query },
          options: { sources: ['external'], limit: 10 }
        })
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Search failed (${response.status})`);
      }

      const mappedResults: SearchResult[] = (payload?.result?.results || []).map((item: any, index: number) => ({
        id: String(item.id || `${index + 1}`),
        title: item.title || 'Untitled result',
        url: item.url || '#',
        snippet: item.snippet || ''
      }));

      setResults(mappedResults);
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : 'Search unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`search-container ${className}`}>
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
        />
        <button onClick={handleSearch} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </div>

      {error && <p>{error}</p>}
      
      {results.length > 0 && (
        <div>
          {results.map((result) => (
            <div key={result.id}>
              <h3>{result.title}</h3>
              <p>{result.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Export both default and named for compatibility
export { WebSearchComponent };
export default WebSearchComponent;