'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function OpenMindDemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Hello! I'm OpenMind, a neural chat assistant. How can I help you today?", timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/neural-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input, intent: 'learn', depth: 'deep' })
      });

      if (!response.ok) throw new Error(`Search failed: ${response.status}`);

      const data = await response.json();
      const resultsText = data.results && data.results.length > 0
        ? data.results.slice(0, 3).map((r: any, i: number) =>
            `${i + 1}. ${r.title}\n   ${r.description || 'No description available'}`
          ).join('\n\n')
        : "I couldn't find specific information about that. Try asking about system features like Weather, Finance, or Security monitoring.";

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: resultsText, timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: (Date.now() + 2).toString(), role: 'assistant', content: 'Error processing your request. Please try again.', timestamp: new Date() }]);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/ultra-saas" className="text-cyan-400 hover:text-cyan-300 mb-6 inline-block">← Back to Ultra SaaS</Link>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 mb-2">🧠 OpenMind Demo</h1>
          <p className="text-xl text-gray-300">Neural Chat Assistant with Real Search Integration</p>
          <p className="text-sm text-gray-500 mt-2">Uses Ollama LLM + DuckDuckGo + Free APIs for real results</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl px-4 py-3 rounded-lg ${message.role === 'user' ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-none'}`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs text-gray-400 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg rounded-bl-none">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-100"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center">
                <div className="bg-red-900/30 border border-red-500 px-4 py-3 rounded-lg text-sm text-red-300">{error}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-700 p-4 bg-gray-950">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything... (powered by real search)"
                disabled={isLoading}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors">
                {isLoading ? '⏳' : '📤'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h3 className="text-cyan-400 font-bold mb-2">🧠 Neural Search</h3>
            <p className="text-sm text-gray-400">Uses DuckDuckGo and GitHub search for real results</p>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h3 className="text-purple-400 font-bold mb-2">⚡ Real Integration</h3>
            <p className="text-sm text-gray-400">Connects to /api/neural-search with actual data sources</p>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h3 className="text-pink-400 font-bold mb-2">✅ Zero Mock Data</h3>
            <p className="text-sm text-gray-400">All results from real APIs, no simulated data</p>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Try asking about: "weather", "financial markets", "system health", "security"</p>
          <p className="mt-2">
            Or explore:
            <Link href="/ultra-industrial" className="text-cyan-400 hover:text-cyan-300 mx-1">Ultra Industrial</Link>
            <Link href="/best" className="text-purple-400 hover:text-purple-300 mx-1">BEST Analytics</Link>
            <Link href="/neural-dev" className="text-pink-400 hover:text-pink-300 mx-1">Neural Dev</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
