const PRIMARY_OCEAN_URL = process.env.OCEAN_CORE_URL;
const OCEAN_INTERNAL_URL =
  process.env.OCEAN_INTERNAL_URL || "http://clisonix-ocean-core:8030";
const OCEAN_LOCAL_URL = "http://localhost:8030";
const PUBLIC_OCEAN_URL = process.env.NEXT_PUBLIC_OCEAN_API_URL;
const isDev = process.env.NODE_ENV !== "production";

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface WebResearchPacket {
  active: boolean;
  mode: "web-assisted";
  query: string;
  sources: ResearchSource[];
  browsedPage?: {
    title: string;
    url: string;
    excerpt: string;
  };
  summaryLines: string[];
}

function buildUpstreamCandidates(): string[] {
  const ordered = [
    OCEAN_INTERNAL_URL,
    PRIMARY_OCEAN_URL,
    isDev ? OCEAN_LOCAL_URL : undefined,
    PUBLIC_OCEAN_URL,
  ]
    .filter((url): url is string => Boolean(url && url.trim()))
    .map((url) => url.replace(/\/+$/, ""));

  return [...new Set(ordered)];
}

const WEB_RESEARCH_PATTERNS = [
  /\b(latest|recent|current|today|news|update|updates|trend|trends|compare|comparison|source|sources|cite|citation|web|internet|online|website|search|look up|find out)\b/i,
  /\b(sot|aktual|aktuale|tani|lajm|lajme|përditësim|perditesim|trend|krahaso|krahasim|burim|burime|internet|web|online|kërko|kerko|gjej)\b/i,
  /\b(heute|aktuell|neueste|nachrichten|quelle|quellen|web|internet|online|suche|finden|vergleich)\b/i,
  /\b(loi|law|laws|legal|regulation|regulations|policy|policies|court|compliance)\b/i,
];

export function shouldUseWebResearch(question: string): boolean {
  const normalized = question.trim();
  if (!normalized) return false;
  return WEB_RESEARCH_PATTERNS.some((pattern) => pattern.test(normalized));
}

async function fetchOceanJson(path: string): Promise<any> {
  let lastError = "No upstream candidates configured";

  for (const upstream of buildUpstreamCandidates()) {
    try {
      const response = await fetch(`${upstream}${path}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = `${response.status} from ${upstream}`;
        continue;
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown upstream error";
    }
  }

  throw new Error(lastError);
}

function normalizeSources(raw: any): ResearchSource[] {
  const results = Array.isArray(raw?.results)
    ? raw.results
    : Array.isArray(raw?.data?.results)
      ? raw.data.results
      : [];

  return results
    .map((item: any) => ({
      title: typeof item?.title === "string" ? item.title.trim() : "Untitled source",
      url: typeof item?.url === "string" ? item.url.trim() : "",
      snippet: typeof item?.snippet === "string" ? item.snippet.trim() : undefined,
    }))
    .filter((item: ResearchSource) => item.url.length > 0)
    .slice(0, 4);
}

function buildSummaryLines(sources: ResearchSource[]): string[] {
  return sources.slice(0, 3).map((source, index) => {
    const snippet = source.snippet ? ` — ${source.snippet}` : "";
    return `${index + 1}. ${source.title}${snippet}`;
  });
}

export async function performWebResearch(
  question: string,
): Promise<WebResearchPacket | null> {
  const query = question.trim();
  if (!query) return null;

  try {
    const searchPayload = await fetchOceanJson(
      `/api/v1/search?q=${encodeURIComponent(query)}&num=4`,
    );
    const sources = normalizeSources(searchPayload);

    if (!sources.length) {
      return null;
    }

    let browsedPage: WebResearchPacket["browsedPage"];

    try {
      const firstUrl = sources[0]?.url;
      if (firstUrl) {
        const browsePayload = await fetchOceanJson(
          `/api/v1/browse?url=${encodeURIComponent(firstUrl)}&max_chars=3500`,
        );
        if (typeof browsePayload?.content === "string") {
          browsedPage = {
            title:
              typeof browsePayload?.title === "string"
                ? browsePayload.title
                : sources[0].title,
            url:
              typeof browsePayload?.url === "string"
                ? browsePayload.url
                : firstUrl,
            excerpt: browsePayload.content.slice(0, 1000),
          };
        }
      }
    } catch {
      // Search evidence is still useful without page browsing.
    }

    return {
      active: true,
      mode: "web-assisted",
      query,
      sources,
      browsedPage,
      summaryLines: buildSummaryLines(sources),
    };
  } catch {
    return null;
  }
}

export function buildWebResearchSystemMessage(
  packet: WebResearchPacket | null,
): string | null {
  if (!packet?.active || packet.sources.length === 0) {
    return null;
  }

  const sourceBlock = packet.summaryLines.join("\n");
  const browseBlock = packet.browsedPage
    ? `\nBrowsed page focus:\nTitle: ${packet.browsedPage.title}\nURL: ${packet.browsedPage.url}\nExcerpt:\n${packet.browsedPage.excerpt}`
    : "";

  return [
    "Web research packet attached.",
    `Use these current external signals carefully for the query: ${packet.query}`,
    "Prefer the provided evidence over guesswork, and be explicit about uncertainty.",
    "Search summary:",
    sourceBlock,
    browseBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}
