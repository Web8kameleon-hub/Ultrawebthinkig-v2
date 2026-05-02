import { NextRequest, NextResponse } from 'next/server';

type ProductKind = 'api' | 'iot';

type UsageProduct = {
  id: string;
  kind: ProductKind;
  name: string;
  description: string;
  unitLabel: string;
  includedUnits: number;
  pricePerUnitEur: number;
};

type QuoteLine = {
  productId: string;
  name: string;
  kind: ProductKind;
  unitLabel: string;
  usageUnits: number;
  includedUnits: number;
  billedUnits: number;
  pricePerUnitEur: number;
  costEur: number;
};

const products: UsageProduct[] = [
  {
    id: 'api-core',
    kind: 'api',
    name: 'Core API Gateway',
    description: 'Authentication, core queries, and standard business endpoints.',
    unitLabel: 'API calls',
    includedUnits: 50000,
    pricePerUnitEur: 0.0008,
  },
  {
    id: 'api-intelligence',
    kind: 'api',
    name: 'Intelligence API',
    description: 'AI-powered enrichments and higher-compute endpoint calls.',
    unitLabel: 'AI calls',
    includedUnits: 10000,
    pricePerUnitEur: 0.0035,
  },
  {
    id: 'iot-telemetry',
    kind: 'iot',
    name: 'IoT Telemetry Stream',
    description: 'Ingests sensor telemetry packets with retention and monitoring.',
    unitLabel: 'messages',
    includedUnits: 200000,
    pricePerUnitEur: 0.00004,
  },
  {
    id: 'iot-control',
    kind: 'iot',
    name: 'IoT Device Control',
    description: 'Two-way command and control operations for connected devices.',
    unitLabel: 'commands',
    includedUnits: 50000,
    pricePerUnitEur: 0.00012,
  },
];

function parseUnits(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function calculateLine(product: UsageProduct, usageUnits: number): QuoteLine {
  const billedUnits = Math.max(0, usageUnits - product.includedUnits);
  const costEur = Number((billedUnits * product.pricePerUnitEur).toFixed(2));

  return {
    productId: product.id,
    name: product.name,
    kind: product.kind,
    unitLabel: product.unitLabel,
    usageUnits,
    includedUnits: product.includedUnits,
    billedUnits,
    pricePerUnitEur: product.pricePerUnitEur,
    costEur,
  };
}

function buildQuote(apiProductId: string, iotProductId: string, apiUsage: number, iotUsage: number) {
  const apiProduct = products.find((entry) => entry.id === apiProductId && entry.kind === 'api');
  const iotProduct = products.find((entry) => entry.id === iotProductId && entry.kind === 'iot');

  if (!apiProduct || !iotProduct) {
    return null;
  }

  const lines = [
    calculateLine(apiProduct, apiUsage),
    calculateLine(iotProduct, iotUsage),
  ];

  const totalCostEur = Number(lines.reduce((sum, line) => sum + line.costEur, 0).toFixed(2));

  return {
    currency: 'EUR',
    model: 'pay-what-you-use',
    formula: 'cost = max(0, usage - included) x unit_price',
    lines,
    totalCostEur,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';

  if (action === 'quote') {
    const apiProductId = searchParams.get('apiProductId') || 'api-core';
    const iotProductId = searchParams.get('iotProductId') || 'iot-telemetry';
    const apiUsage = parseUnits(searchParams.get('apiUsage'), 120000);
    const iotUsage = parseUnits(searchParams.get('iotUsage'), 350000);

    const quote = buildQuote(apiProductId, iotProductId, apiUsage, iotUsage);
    if (!quote) {
      return NextResponse.json({ success: false, error: 'Invalid product selection' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: quote,
    });
  }

  const apiProducts = products.filter((entry) => entry.kind === 'api');
  const iotProducts = products.filter((entry) => entry.kind === 'iot');

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      model: 'pay-what-you-use',
      currency: 'EUR',
      apiProducts,
      iotProducts,
      examples: {
        startup: buildQuote('api-core', 'iot-telemetry', 90000, 260000),
        growth: buildQuote('api-intelligence', 'iot-control', 420000, 1500000),
      },
    },
  });
}
