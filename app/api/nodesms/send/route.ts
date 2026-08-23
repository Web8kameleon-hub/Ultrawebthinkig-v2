import { NextRequest, NextResponse } from 'next/server';
import { encodeMessage, toBase64, BinaryEncoding } from '../../../../utils/cbor-msgpack';

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

type RealGatewayConfig = {
  urlEnv: string;
  apiKeyEnv: string;
  serviceName: string;
};

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

function getGatewayConfig(channel: 'http' | 'lorawan'): RealGatewayConfig {
  if (channel === 'lorawan') {
    return {
      urlEnv: 'LORA_MESH_URL',
      apiKeyEnv: 'LORA_MESH_API_KEY',
      serviceName: 'lora-mesh',
    };
  }

  return {
    urlEnv: 'NODESMS_GATEWAY_URL',
    apiKeyEnv: 'NODESMS_GATEWAY_API_KEY',
    serviceName: 'nodesms-gateway',
  };
}

async function sendToRealGateway(
  channel: 'http' | 'lorawan',
  envelope: Record<string, unknown>,
  payloadBase64: string,
  timeoutMs: number
) {
  const config = getGatewayConfig(channel);
  const target = process.env[config.urlEnv]?.trim();

  if (!target) {
    return {
      ok: false as const,
      status: 503,
      body: {
        ok: false,
        error: `${config.urlEnv} is not configured`,
        service: config.serviceName,
      },
    };
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };

  const apiKey = process.env[config.apiKeyEnv]?.trim();
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const upstreamPayload = {
    channel,
    envelope,
    payloadBase64,
  };

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(upstreamPayload),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseType = response.headers.get('content-type') || '';
    const upstreamData = responseType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        body: {
          ok: false,
          error: 'Real gateway rejected payload',
          service: config.serviceName,
          upstream: upstreamData,
        },
      };
    }

    return {
      ok: true as const,
      status: 200,
      body: {
        ok: true,
        service: config.serviceName,
        upstream: upstreamData,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 502,
      body: {
        ok: false,
        error: 'Failed to reach real gateway service',
        service: config.serviceName,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
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
    const timeoutMs = Number(process.env.REAL_SERVICE_TIMEOUT_MS || '15000');

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

    const realGateway = await sendToRealGateway(channel, envelope, payloadBase64, timeoutMs);
    if (!realGateway.ok) {
      return NextResponse.json(realGateway.body, { status: realGateway.status });
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
          queue: null,
          realGateway: realGateway.body,
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
