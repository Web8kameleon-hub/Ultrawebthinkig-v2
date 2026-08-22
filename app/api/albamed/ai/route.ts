import { NextResponse } from 'next/server';
import { albaMedLaboratory } from '../../../../lib/albamed/laboratory';
import { readMedicalSession } from '../../../../lib/medical/session';

export async function POST(request: Request) {
  try {
    const session = await readMedicalSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Medical license session required' }, { status: 401 });
    }

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

    if (!result.approval.approved || !result.summary || result.summary === 'no data') {
      return NextResponse.json(
        {
          success: false,
          error: 'The real provider output did not pass the medical approval gate',
          source: result.source,
          metadata: {
            confidence: result.confidence,
            approvalVotes: result.approval.receivedVotes,
            requiredVotes: result.approval.requiredVotes,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      response: result.summary,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AlbaMed AI service failed';
    const status = message.includes('not configured') || message.includes('not available') ? 503 : 502;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
