import { NextResponse } from 'next/server';

type AlbaMedPayload = {
  systemStatus?: {
    ai?: string;
    db?: string;
  };
  patients?: Array<{
    id: string;
    name: string;
    age: number;
    condition: string;
    status: 'stable' | 'monitoring' | 'critical';
    lastUpdate: string;
  }>;
};

export async function GET() {
  const sourceUrl = process.env.ALBAMED_SOURCE_URL;

  if (!sourceUrl) {
    return NextResponse.json({
      success: true,
      data: null,
      message: 'no data',
      source: 'none',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'no data',
        source: sourceUrl,
        status: response.status,
        timestamp: new Date().toISOString(),
      });
    }

    const upstream = (await response.json()) as AlbaMedPayload;
    const hasData = !!upstream?.systemStatus || (Array.isArray(upstream?.patients) && upstream.patients.length > 0);

    return NextResponse.json({
      success: true,
      data: hasData ? upstream : null,
      message: hasData ? 'ok' : 'no data',
      source: sourceUrl,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: null,
      message: 'no data',
      source: sourceUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
