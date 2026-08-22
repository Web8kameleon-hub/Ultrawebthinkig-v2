import { requireHttpUrl } from './config';

type FhirBundle<T> = { resourceType?: string; entry?: Array<{ resource?: T }> };

export type FhirObservation = {
  id?: string;
  status?: string;
  subject?: { reference?: string };
  code?: { text?: string; coding?: Array<{ display?: string }> };
  interpretation?: Array<{ text?: string; coding?: Array<{ code?: string; display?: string }> }>;
  effectiveDateTime?: string;
  issued?: string;
};

export class FHIRClient {
  private readonly baseUrl = requireHttpUrl('FHIR_SERVER_URL');
  private readonly token = process.env.FHIR_AUTH_TOKEN?.trim();

  private headers(): HeadersInit {
    return {
      accept: 'application/fhir+json',
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async queryObservations(params: Record<string, string>): Promise<FhirBundle<FhirObservation>> {
    const url = new URL(`${this.baseUrl.toString().replace(/\/$/, '')}/Observation`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, {
      headers: this.headers(),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`FHIR server returned ${response.status}`);
    return response.json() as Promise<FhirBundle<FhirObservation>>;
  }
}
