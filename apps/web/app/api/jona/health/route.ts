import { apiError, apiSuccess } from '@/lib/api/response';
import { buildJonaHealthSnapshot } from '@/lib/jona/health';
import { fetchJsonFromCandidates } from "../../_lib/upstream";

const JONA_UPSTREAM_PATH = '/asi/status';

export async function GET() {
  try {
    const { data: payload, source } = await fetchJsonFromCandidates<Record<string, unknown>>({
      group: "api",
      path: JONA_UPSTREAM_PATH,
    });

    const trinity =
      payload.trinity && typeof payload.trinity === 'object'
        ? (payload.trinity as Record<string, unknown>)
        : null;
    const jonaData = trinity?.jona;

    if (!jonaData || typeof jonaData !== 'object') {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'JONA payload missing from Trinity response',
        {
          status: 503,
          details: {
            upstream: source,
          },
        },
      );
    }

    const snapshot = buildJonaHealthSnapshot(
      jonaData as Record<string, unknown>,
      source,
      typeof payload.timestamp === 'string' ? payload.timestamp : undefined,
    );

    return apiSuccess(snapshot, {
      meta: {
        upstream: source,
      },
    });
  } catch (error) {
    console.error('[JONA health] Error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to resolve JONA health contract', {
      status: 500,
      details: String(error),
    });
  }
}
