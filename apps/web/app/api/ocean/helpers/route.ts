/**
 * API Endpoint: /api/ocean/helpers
 * Routes questions through deterministic helpers before falling back to Ocean-core
 * Prevents hallucinations and ensures factual answers for math/science
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleQuestion,
  validateQuestion,
  getHelperRegistry,
  type HandleQuestionOptions,
} from "../../../lib/oceanHelpers";

/**
 * GET /api/ocean/helpers
 * Returns helper registry and health status
 */
async function handleGetRequest() {
  const registry = getHelperRegistry();
  return NextResponse.json({
    status: 'ok',
    message: 'Ocean Helpers Engine',
    version: '1.0.0',
    registry,
    endpoints: {
      query: 'POST /api/ocean/helpers',
      registry: 'GET /api/ocean/helpers',
    },
  });
}

/**
 * POST /api/ocean/helpers
 * Body: { question: string, debug?: boolean, stream?: boolean }
 */
async function handlePostRequest(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, debug = false, stream = false } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: '"question" field is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Security validation
    const { safe, reason } = validateQuestion(question);
    if (!safe) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: reason,
          blocked: true,
        },
        { status: 403 }
      );
    }

    // Build options
    const options: HandleQuestionOptions = {
      includeDebug: debug,
      fallbackToReasoning: true,
    };

    // Handle streaming vs. single response
    if (stream) {
      return handleStreamingResponse(question, options);
    }

    // Single response
    const result = await handleQuestion(question, options);

    return NextResponse.json({
      ok: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Ocean Helpers Error]', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Stream response (SSE format)
 * Compatible with Ocean stream protocol
 */
function handleStreamingResponse(
  question: string,
  options: HandleQuestionOptions
) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial message
        const initialData = {
          event: 'start',
          message: 'Helper routing question...',
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          `data: ${JSON.stringify(initialData)}\n\n`
        );

        // Get helper result
        const result = await handleQuestion(question, options);

        // Send result
        const resultData = {
          event: 'result',
          data: result,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          `data: ${JSON.stringify(resultData)}\n\n`
        );

        // If reasoning needed, would stream Ocean-core response here
        if (result.domain === 'reasoning' && result.ok) {
          const streamData = {
            event: 'stream_notice',
            message: 'Streaming from Ocean-core...',
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            `data: ${JSON.stringify(streamData)}\n\n`
          );

          // TODO: Fetch from /api/ocean/stream and relay chunks
          // This requires async handling in stream controller
        }

        // Send done signal
        const doneData = {
          event: 'done',
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          `data: ${JSON.stringify(doneData)}\n\n`
        );

        controller.close();
      } catch (error) {
        const errorData = {
          event: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          `data: ${JSON.stringify(errorData)}\n\n`
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Unified request handler
 */
export async function GET(request: NextRequest) {
  return handleGetRequest();
}

export async function POST(request: NextRequest) {
  return handlePostRequest(request);
}

/**
 * OPTIONS for CORS pre-flight
 */
export async function OPTIONS() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
