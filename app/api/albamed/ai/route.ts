import { NextResponse } from 'next/server';
import { albaMedLaboratory } from '../../../../lib/albamed/laboratory';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      language?: string;
      modules?: string[];
      context?: string[];
      useCloud?: boolean;
      chunkSize?: number;
    };

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message is required',
        },
        { status: 400 }
      );
    }

    const result = await albaMedLaboratory.run({
      message,
      language: body.language,
      modules: Array.isArray(body.modules) ? body.modules : [],
      context: Array.isArray(body.context) ? body.context : [],
      useCloud: !!body.useCloud,
      chunkSize: body.chunkSize,
    });

    return NextResponse.json({
      success: true,
      response: result.summary || 'no data',
      source: result.source,
      thinking_time: result.thinkingTime,
      metadata: {
        confidence: result.confidence,
        agentCount: result.agentResults.length,
        activeAgentCount: result.agentResults.filter((item) => item.text !== 'no data').length,
        approved: result.approval.approved,
        approvalVotes: result.approval.receivedVotes,
        requiredVotes: result.approval.requiredVotes,
        approvalConfidence: result.approval.avgConfidence,
        searchHitCount: result.searchHits.length,
      },
      agents: result.agentResults,
      approvals: result.approval,
      searchHits: result.searchHits,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        success: true,
        response: 'no data',
        source: 'none',
        thinking_time: 0,
        metadata: { confidence: 0, agentCount: 0, activeAgentCount: 0 },
      },
      { status: 200 }
    );
  }
}
