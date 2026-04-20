import { apiError, apiSuccess } from "@/lib/api/response";
import { fetchJsonFromCandidates } from "../../_lib/upstream";

export async function GET() {
  try {
    const { data, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: "/health",
    });

    return apiSuccess(data, {
      meta: {
        upstream: source,
      },
    });
  } catch (error) {
    return apiError(
      "UPSTREAM_UNAVAILABLE",
      "Failed to connect to Main API health endpoint",
      {
        status: 503,
        details: {
          reason: String(error),
        },
      },
    );
  }
}
