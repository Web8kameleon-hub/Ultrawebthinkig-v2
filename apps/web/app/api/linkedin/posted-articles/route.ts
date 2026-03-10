import { NextResponse } from "next/server";

const LINKEDIN_CANDIDATES = [
  process.env.LINKEDIN_API_URL,
  "http://clisonix-linkedin-poster:8007",
  "http://linkedin-poster:8007",
  "http://localhost:8007",
].filter((url): url is string => Boolean(url && url.trim()));

export async function GET() {
  let lastError = "LinkedIn service unavailable";

  for (const base of LINKEDIN_CANDIDATES) {
    try {
      const response = await fetch(`${base}/api/linkedin/posted-articles`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        lastError = `Unexpected response type from ${base}`;
        continue;
      }

      const data = await response.json();
      if (response.ok) {
        return NextResponse.json(data);
      }

      lastError = data?.error || data?.detail || `HTTP ${response.status}`;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Unknown request error";
    }
  }

  console.error("Error fetching posted articles:", lastError);
  return NextResponse.json(
    { posted: [], count: 0, error: lastError },
    { status: 502 },
  );
}
