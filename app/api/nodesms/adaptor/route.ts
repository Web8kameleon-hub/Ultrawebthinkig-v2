import { NextRequest, NextResponse } from 'next/server';
import { decodeMessage, fromBase64, BinaryEncoding } from '../../../../utils/cbor-msgpack';

interface AdaptorBody {
  payloadBase64?: string;
  bytes?: number[];
  encoding?: BinaryEncoding;
}

function toUint8Array(body: AdaptorBody): Uint8Array | null {
  if (body.payloadBase64 && typeof body.payloadBase64 === 'string') {
    return fromBase64(body.payloadBase64);
  }

  if (Array.isArray(body.bytes)) {
    return new Uint8Array(body.bytes);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AdaptorBody;
    const encoding = body.encoding ?? 'cbor';

    const rawBytes = toUint8Array(body);
    if (!rawBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing payload. Provide `payloadBase64` or `bytes`',
        },
        { status: 400 }
      );
    }

    const decoded = decodeMessage<Record<string, unknown>>(rawBytes, encoding);

    return NextResponse.json({
      ok: true,
      encoding,
      byteLength: rawBytes.byteLength,
      data: decoded,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to decode NodeSMS payload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'nodesms-adaptor',
    expects: {
      payloadBase64: 'string',
      bytes: 'number[]',
      encoding: ['cbor', 'msgpack'],
    },
  });
}
