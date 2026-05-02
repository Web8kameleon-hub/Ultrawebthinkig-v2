/**
 * Web8 AI Chat API - Real Implementation
 * NO MOCK DATA - ALL REAL RESPONSES
 * @route POST /api/chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { neuralSearchEngine, NeuralSearchResult } from '../../../backend/search/neuralSearchEngine';

interface ChatRequest {
  message: string;
  provider?: string;
  conversationId?: string;
}

interface ChatResponse {
  success: boolean;
  response: string;
  provider: string;
  confidence: number;
  timestamp: string;
  searchResults?: NeuralSearchResult[];
  metadata?: {
    processingTime?: number;
    sources?: string[];
    realAPI?: boolean;
  };
}

const conversationStore = new Map<string, { messages: any[]; timestamp: number }>();

// Cleanup conversations older than 24h
setInterval(() => {
  const now = Date.now();
  for (const [id, conv] of conversationStore.entries()) {
    if (now - conv.timestamp > 24 * 60 * 60 * 1000) conversationStore.delete(id);
  }
}, 60 * 60 * 1000);

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now();

  try {
    const body: ChatRequest = await request.json();
    const { message, provider = 'neural-search', conversationId } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ success: false, response: 'Message cannot be empty', provider, confidence: 0, timestamp: new Date().toISOString() }, { status: 400 });
    }

    const conversation = conversationId ? conversationStore.get(conversationId) : null;
    const previousQueries = (conversation?.messages || []).slice(-5).map((m: any) => m.content).filter(Boolean);

    const searchResults = await neuralSearchEngine.searchNeural(message, {
      intent: detectIntent(message),
      depth: 'surface',
      userContext: { previousQueries, preferences: [], expertise: 'intermediate' }
    });

    const response = generateResponse(message, searchResults);
    const processingTime = Date.now() - startTime;

    if (conversationId) {
      if (!conversationStore.has(conversationId)) conversationStore.set(conversationId, { messages: [], timestamp: Date.now() });
      const conv = conversationStore.get(conversationId)!;
      conv.messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      conv.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
      conv.timestamp = Date.now();
    }

    return NextResponse.json({
      success: true, response, provider, timestamp: new Date().toISOString(),
      confidence: Math.min(0.95, 0.7 + (searchResults.length > 0 ? 0.2 : 0)),
      searchResults: searchResults.slice(0, 3),
      metadata: { processingTime, sources: [...new Set(searchResults.map(r => r.source))], realAPI: true }
    }, { status: 200 });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json(
      { success: false, response: 'An error occurred while processing your request.', provider: 'error', confidence: 0, timestamp: new Date().toISOString(), metadata: { processingTime: Date.now() - startTime, realAPI: false } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'health') {
    return NextResponse.json({ status: 'healthy', active: true, timestamp: new Date().toISOString(), capabilities: ['neural-search', 'conversation-context', 'multi-provider-support'] });
  }

  if (action === 'stats') {
    const stats = neuralSearchEngine.getSearchStats();
    return NextResponse.json({ ...stats, conversationCount: conversationStore.size, timestamp: new Date().toISOString() });
  }

  return NextResponse.json({ message: 'Chat API is healthy', endpoint: '/api/chat', methods: ['POST', 'GET'] });
}

function detectIntent(message: string): 'search' | 'learn' | 'code' | 'analyze' | 'create' {
  const m = message.toLowerCase();
  if (m.includes('how') || m.includes('what') || m.includes('why') || m.includes('?')) return 'learn';
  if (m.includes('code') || m.includes('function') || m.includes('implement')) return 'code';
  if (m.includes('analyze') || m.includes('compare')) return 'analyze';
  if (m.includes('create') || m.includes('generate') || m.includes('write')) return 'create';
  return 'search';
}

function generateResponse(message: string, results: NeuralSearchResult[]): string {
  if (results.length > 0) {
    const top = results[0];
    let resp = top.description || `Found relevant information about: ${top.title || message}`;
    if (results.length > 1 && message.toLowerCase().includes('detail')) {
      resp += '\n\nAdditional sources:\n' + results.slice(1, 3).map(r => `• ${r.title}`).join('\n');
    }
    return resp;
  }
  return `Processing: "${message}". Try rephrasing with more specific keywords.`;
}
