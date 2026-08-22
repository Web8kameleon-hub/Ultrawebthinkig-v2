import { NextRequest, NextResponse } from 'next/server';
import { encodeMessage, toBase64, BinaryEncoding } from '../../../../utils/cbor-msgpack';
import { queueNodeSmsForLoRa } from '../../../../lora/nodesms-mesh';

interface NodeSmsSendBody {
  to: string;
  from?: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  channel?: 'http' | 'lorawan';
  encoding?: BinaryEncoding;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

const requestLog: Array<{ id: string; createdAt: string; to: string; channel: string }> = [];

function isValidString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const sanitized = trimmed.replace(/[^\d+]/g, '');
  if (sanitized.startsWith('+')) {
    return `+${sanitized.slice(1).replace(/\D/g, '')}`;
  }
  return sanitized.replace(/\D/g, '');
}

function isE164Like(input: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(input);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NodeSmsSendBody;
    const recipient = isValidString(body.to, 3, 128) ? normalizePhone(body.to) : '';

    if (!recipient || !isE164Like(recipient)) {
      return NextResponse.json({ error: 'Invalid `to` phone number. Expected E.164 format.' }, { status: 400 });
    }

    if (!isValidString(body.message, 1, 2048)) {
      return NextResponse.json({ error: 'Invalid `message` value' }, { status: 400 });
    }

    const id = `nodesms_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const priority = body.priority ?? 'normal';
    const encoding = body.encoding ?? 'cbor';
    const channel = body.channel ?? 'http';
    const ttlSeconds = Math.max(30, Math.min(body.ttlSeconds ?? 3600, 86400));

    const envelope = {
      id,
      to: recipient,
      from: body.from?.trim() || 'nodesms-gateway',
      message: body.message,
      priority,
      channel,
      ttlSeconds,
      metadata: body.metadata ?? {},
      createdAt,
      version: 1,
    };

    const binaryPayload = encodeMessage(envelope, encoding);
    const payloadBase64 = toBase64(binaryPayload);

    requestLog.unshift({ id, createdAt, to: envelope.to, channel });
    if (requestLog.length > 500) {
      requestLog.length = 500;
    }

    let loRaQueue = null;
    if (channel === 'lorawan') {
      loRaQueue = queueNodeSmsForLoRa({
        id,
        to: envelope.to,
        from: envelope.from,
        message: envelope.message,
        priority,
        createdAt,
        payloadBase64,
        ttlSeconds,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          id,
          channel,
          encoding,
          createdAt,
          payloadBase64,
          byteLength: binaryPayload.byteLength,
          queue: loRaQueue,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to send NodeSMS payload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'nodesms-send',
    totalRequests: requestLog.length,
    latest: requestLog.slice(0, 20),
  });
}
