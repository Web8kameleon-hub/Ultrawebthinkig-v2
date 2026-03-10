import { NextRequest, NextResponse } from "next/server";

const LINKEDIN_CANDIDATES = [
  process.env.LINKEDIN_API_URL,
  "http://clisonix-linkedin-poster:8007",
  "http://linkedin-poster:8007",
  "http://localhost:8007",
].filter((url): url is string => Boolean(url && url.trim()));

async function postToLinkedin(path: string, body?: string) {
  let lastError = "LinkedIn service unavailable";

  for (const base of LINKEDIN_CANDIDATES) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const payload = isJson
        ? await response.json()
        : { success: false, error: await response.text() };

      if (response.ok) {
        return NextResponse.json(payload);
      }

      lastError =
        payload?.error || payload?.detail || `HTTP ${response.status}`;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Unknown request error";
    }
  }

  return NextResponse.json(
    { success: false, error: lastError },
    { status: 502 },
  );
}

export async function POST(request: NextRequest) {
  try {
    return await postToLinkedin("/api/linkedin/post-daily");
  } catch (error) {
    console.error("Error triggering daily post:", error);
    return NextResponse.json(
      { success: false, error: "Failed to trigger daily post" },
      { status: 500 },
    );
  }
}
