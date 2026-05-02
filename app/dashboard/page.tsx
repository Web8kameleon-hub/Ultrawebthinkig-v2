'use client';

import { useEffect, useMemo, useState } from 'react';

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

type QuoteResponse = {
  data: {
    formula: string;
    lines: QuoteLine[];
    totalCostEur: number;
  };
};

type DashboardResponse = {
  data: {
    apiProducts: UsageProduct[];
    iotProducts: UsageProduct[];
  };
};

export default function DashboardPage() {
  const [apiProducts, setApiProducts] = useState<UsageProduct[]>([]);
  const [iotProducts, setIotProducts] = useState<UsageProduct[]>([]);
  const [apiProductId, setApiProductId] = useState('api-core');
  const [iotProductId, setIotProductId] = useState('iot-telemetry');
  const [apiUsage, setApiUsage] = useState(120000);
  const [iotUsage, setIotUsage] = useState(350000);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [formula, setFormula] = useState('cost = max(0, usage - included) x unit_price');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await fetch('/api/usage-pricing?action=dashboard', { cache: 'no-store' });
        const payload: DashboardResponse = await response.json();

        const fetchedApi = payload?.data?.apiProducts || [];
        const fetchedIot = payload?.data?.iotProducts || [];

        setApiProducts(fetchedApi);
        setIotProducts(fetchedIot);

        if (fetchedApi[0]?.id) setApiProductId(fetchedApi[0].id);
        if (fetchedIot[0]?.id) setIotProductId(fetchedIot[0].id);
      } catch (error) {
        console.error('Failed to load usage pricing catalog:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, []);

  useEffect(() => {
    if (!apiProductId || !iotProductId) {
      return;
    }

    const calculateQuote = async () => {
      try {
        const query = new URLSearchParams({
          action: 'quote',
          apiProductId,
          iotProductId,
          apiUsage: String(apiUsage),
          iotUsage: String(iotUsage),
        });

        const response = await fetch(`/api/usage-pricing?${query.toString()}`, { cache: 'no-store' });
        const payload: QuoteResponse = await response.json();

        setLines(payload?.data?.lines || []);
        setTotalCost(payload?.data?.totalCostEur || 0);
        setFormula(payload?.data?.formula || formula);
      } catch (error) {
        console.error('Failed to calculate usage quote:', error);
      }
    };

    calculateQuote();
  }, [apiProductId, iotProductId, apiUsage, iotUsage]);

  const selectedApi = useMemo(
    () => apiProducts.find((product) => product.id === apiProductId),
    [apiProducts, apiProductId]
  );

  const selectedIot = useMemo(
    () => iotProducts.find((product) => product.id === iotProductId),
    [iotProducts, iotProductId]
  );

  const eur = (value: number) => `EUR ${value.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-cyan-300">Usage Pricing Dashboard</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Dashboard i produkteve API dhe IoT me model "pay what you use".
              Paguani vetem per perdorimin mbi kufirin e perfshire.
            </p>
          </div>
          <a
            href="/ultra-saas"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold hover:border-cyan-400"
          >
            Back to Ultra SaaS
          </a>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 lg:col-span-2">
            <h2 className="text-xl font-semibold text-emerald-300">Product Configuration</h2>

            {loading ? (
              <p className="mt-4 text-slate-300">Loading catalog...</p>
            ) : (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
                  <label htmlFor="api-product" className="text-sm font-semibold text-cyan-300">API Product</label>
                  <select
                    id="api-product"
                    title="API Product"
                    value={apiProductId}
                    onChange={(event) => setApiProductId(event.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
                  >
                    {apiProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-slate-300">{selectedApi?.description}</p>
                  <p className="text-xs text-slate-400">
                    Included: {selectedApi?.includedUnits.toLocaleString()} {selectedApi?.unitLabel}
                  </p>
                  <p className="text-xs text-slate-400">
                    Unit price: EUR {selectedApi?.pricePerUnitEur.toFixed(4)} / {selectedApi?.unitLabel}
                  </p>

                  <label htmlFor="api-usage" className="mt-3 block text-sm font-semibold text-slate-200">API Usage</label>
                  <input
                    id="api-usage"
                    title="API Usage"
                    placeholder="Enter API usage units"
                    type="number"
                    min={0}
                    value={apiUsage}
                    onChange={(event) => setApiUsage(Number(event.target.value || 0))}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
                  <label htmlFor="iot-product" className="text-sm font-semibold text-purple-300">IoT Product</label>
                  <select
                    id="iot-product"
                    title="IoT Product"
                    value={iotProductId}
                    onChange={(event) => setIotProductId(event.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
                  >
                    {iotProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-slate-300">{selectedIot?.description}</p>
                  <p className="text-xs text-slate-400">
                    Included: {selectedIot?.includedUnits.toLocaleString()} {selectedIot?.unitLabel}
                  </p>
                  <p className="text-xs text-slate-400">
                    Unit price: EUR {selectedIot?.pricePerUnitEur.toFixed(5)} / {selectedIot?.unitLabel}
                  </p>

                  <label htmlFor="iot-usage" className="mt-3 block text-sm font-semibold text-slate-200">IoT Usage</label>
                  <input
                    id="iot-usage"
                    title="IoT Usage"
                    placeholder="Enter IoT usage units"
                    type="number"
                    min={0}
                    value={iotUsage}
                    onChange={(event) => setIotUsage(Number(event.target.value || 0))}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-5">
            <h2 className="text-xl font-semibold text-cyan-200">Monthly Estimate</h2>
            <p className="mt-2 text-sm text-cyan-100">{formula}</p>

            <div className="mt-5 rounded-lg border border-cyan-500/30 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-300">Total monthly usage bill</p>
              <p className="mt-2 text-4xl font-bold text-white">{eur(totalCost)}</p>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-xl font-semibold text-amber-300">Quote Breakdown</h2>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Included</th>
                  <th className="px-4 py-3">Billed</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/50">
                {lines.map((line) => (
                  <tr key={line.productId}>
                    <td className="px-4 py-3 font-semibold text-white">{line.name}</td>
                    <td className="px-4 py-3 text-slate-300">{line.usageUnits.toLocaleString()} {line.unitLabel}</td>
                    <td className="px-4 py-3 text-slate-300">{line.includedUnits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300">{line.billedUnits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300">EUR {line.pricePerUnitEur.toFixed(5)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-300">{eur(line.costEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
