export interface SignalPoint {
  key: string;
  source: string;
  ok: boolean;
  value?: unknown;
  latencyMs?: number;
  note?: string;
}

export interface OpenDataLink {
  name: string;
  url: string;
  domain: string;
  category:
    | "billing"
    | "economy"
    | "science"
    | "weather"
    | "knowledge"
    | "time"
    | "news"
    | "sports"
    | "culture";
}

export interface OceanSignalSnapshot {
  mode: "signal-hub";
  generatedAt: string;
  question: string;
  pillars: string[];
  engines: string[];
  internalSignals: SignalPoint[];
  externalSignals: SignalPoint[];
  openDataLinks: OpenDataLink[];
  summaryLines: string[];
}

const API_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.BACKEND_API_URL ||
  process.env.API_URL ||
  "http://clisonix-api:8000";

const OCEAN_BASE =
  process.env.OCEAN_INTERNAL_URL ||
  process.env.OCEAN_CORE_URL ||
  "http://clisonix-ocean-core:8030";

const PILLARS = [
  "reasoning",
  "responsibility",
  "reliability",
  "compliance-awareness",
  "open-data-grounding",
  "operational-health",
];

const ENGINES = [
  "ocean-core",
  "main-api",
  "billing",
  "weather",
  "crypto-market",
  "open-economy-feeds",
];

const OPEN_DATA_LINKS: OpenDataLink[] = [
  {
    name: "Frankfurter FX (free ECB-based rates)",
    url: "https://api.frankfurter.app/latest",
    domain: "frankfurter.app",
    category: "billing",
  },
  {
    name: "Open-Meteo Forecast API",
    url: "https://api.open-meteo.com/v1/forecast",
    domain: "open-meteo.com",
    category: "weather",
  },
  {
    name: "CoinGecko Public API",
    url: "https://api.coingecko.com/api/v3/ping",
    domain: "coingecko.com",
    category: "economy",
  },
  {
    name: "World Bank Open Data",
    url: "https://datahelpdesk.worldbank.org/knowledgebase/topics/125589",
    domain: "worldbank.org",
    category: "economy",
  },
  {
    name: "Eurostat Open Data",
    url: "https://ec.europa.eu/eurostat/web/main/data/database",
    domain: "europa.eu",
    category: "economy",
  },
  {
    name: "Wikidata Query Service",
    url: "https://query.wikidata.org/",
    domain: "wikidata.org",
    category: "knowledge",
  },
  {
    name: "World Time API",
    url: "https://worldtimeapi.org/api/timezone/Europe/Tirane",
    domain: "worldtimeapi.org",
    category: "time",
  },
  {
    name: "RSSHub (Open RSS Feeds)",
    url: "https://docs.rsshub.app/",
    domain: "rsshub.app",
    category: "news",
  },
  {
    name: "TheSportsDB Public API",
    url: "https://www.thesportsdb.com/api.php",
    domain: "thesportsdb.com",
    category: "sports",
  },
  {
    name: "Europeana Open Culture Data",
    url: "https://pro.europeana.eu/page/search",
    domain: "europeana.eu",
    category: "culture",
  },
];

async function fetchJsonSignal(
  key: string,
  source: string,
  url: string,
  timeoutMs = 3500,
): Promise<SignalPoint> {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        key,
        source,
        ok: false,
        latencyMs,
        note: `HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as unknown;
    return {
      key,
      source,
      ok: true,
      latencyMs,
      value: payload,
    };
  } catch (error) {
    return {
      key,
      source,
      ok: false,
      latencyMs: Date.now() - startedAt,
      note: error instanceof Error ? error.message : "signal unavailable",
    };
  }
}

function summarizeSignals(
  internalSignals: SignalPoint[],
  externalSignals: SignalPoint[],
): string[] {
  const internalOk = internalSignals.filter((item) => item.ok).length;
  const externalOk = externalSignals.filter((item) => item.ok).length;

  const lines = [
    `Internal signals: ${internalOk}/${internalSignals.length} healthy`,
    `External signals: ${externalOk}/${externalSignals.length} healthy`,
  ];

  const slowest = [...internalSignals, ...externalSignals]
    .filter((item) => typeof item.latencyMs === "number")
    .sort((a, b) => (b.latencyMs || 0) - (a.latencyMs || 0))[0];

  if (slowest?.latencyMs) {
    lines.push(`Slowest signal: ${slowest.key} (${slowest.latencyMs}ms)`);
  }

  const failed = [...internalSignals, ...externalSignals].filter((item) => !item.ok);
  if (failed.length) {
    lines.push(
      `Degraded signals: ${failed
        .slice(0, 4)
        .map((item) => item.key)
        .join(", ")}`,
    );
  }

  return lines;
}

export async function collectOceanSignalSnapshot(
  question: string,
): Promise<OceanSignalSnapshot> {
  const [
    oceanStatus,
    apiStatus,
    weatherSignal,
    cryptoSignal,
    billingSignal,
    fxSignal,
    meteoSignal,
    geckoSignal,
  ] = await Promise.all([
    fetchJsonSignal("ocean_status", "internal", `${OCEAN_BASE}/api/v1/status`),
    fetchJsonSignal("api_status", "internal", `${API_BASE}/status`),
    fetchJsonSignal("weather_feed", "internal", `${API_BASE}/api/weather`),
    fetchJsonSignal("crypto_market", "internal", `${API_BASE}/api/crypto/market`),
    fetchJsonSignal("billing_plans", "internal", `${API_BASE}/api/v1/billing/plans`),
    fetchJsonSignal(
      "fx_rates_free",
      "external",
      "https://api.frankfurter.app/latest?from=EUR&to=USD,CHF,GBP",
    ),
    fetchJsonSignal(
      "open_meteo_free",
      "external",
      "https://api.open-meteo.com/v1/forecast?latitude=47.37&longitude=8.54&current=temperature_2m",
    ),
    fetchJsonSignal("coingecko_ping", "external", "https://api.coingecko.com/api/v3/ping"),
  ]);

  const internalSignals = [
    oceanStatus,
    apiStatus,
    weatherSignal,
    cryptoSignal,
    billingSignal,
  ];
  const externalSignals = [fxSignal, meteoSignal, geckoSignal];

  return {
    mode: "signal-hub",
    generatedAt: new Date().toISOString(),
    question: question.trim(),
    pillars: PILLARS,
    engines: ENGINES,
    internalSignals,
    externalSignals,
    openDataLinks: OPEN_DATA_LINKS,
    summaryLines: summarizeSignals(internalSignals, externalSignals),
  };
}

export function buildSignalSystemMessage(
  snapshot: OceanSignalSnapshot | null,
): string | null {
  if (!snapshot) {
    return null;
  }

  const internalOk = snapshot.internalSignals.filter((item) => item.ok).length;
  const externalOk = snapshot.externalSignals.filter((item) => item.ok).length;

  return [
    "Ocean Signal Hub is active.",
    `Question context: ${snapshot.question}`,
    `Pillars: ${snapshot.pillars.join(" | ")}`,
    `Engines: ${snapshot.engines.join(" | ")}`,
    `Internal health: ${internalOk}/${snapshot.internalSignals.length}`,
    `External health: ${externalOk}/${snapshot.externalSignals.length}`,
    `Signal summary: ${snapshot.summaryLines.join(" ; ")}`,
    "Use available internal and external signals as context, but do not invent missing telemetry.",
  ].join("\n");
}
