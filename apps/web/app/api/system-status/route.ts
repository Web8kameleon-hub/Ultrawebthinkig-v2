import { apiDegraded, apiSuccess } from "@/lib/api/response";
import { fetchJsonFromCandidates } from "../_lib/upstream";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
  try {
    const { data: payload, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/status",
    });
    return apiSuccess(payload, {
      meta: {
        upstream: source,
      },
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    console.error("[system-status] error:", error);
    return apiDegraded(
      null,
      "UPSTREAM_UNAVAILABLE",
      "System status upstream is unavailable",
      {
        status: 502,
        details: {
          reason: String(error),
        },
        meta: {
          fallback: false,
        },
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}
