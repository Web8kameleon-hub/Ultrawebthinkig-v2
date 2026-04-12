import { NextResponse } from "next/server";

const MARKETPLACE_API = process.env.MARKETPLACE_API_URL || null;

export async function GET() {
  if (!MARKETPLACE_API) {
    return NextResponse.json(
      {
        error: "Marketplace service is not configured",
        configured: false,
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${MARKETPLACE_API}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Marketplace health returned a non-200 status",
          status: response.status,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to connect to Marketplace",
        details: String(error),
      },
      { status: 503 },
    );
  }
}
