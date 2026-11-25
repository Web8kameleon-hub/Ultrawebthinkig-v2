import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/medical/config';
import { FHIRClient, type FhirObservation } from '@/lib/medical/fhir-client';
import { pseudonymousId } from '@/lib/medical/gdpr-anonymizer';
import { writeMedicalAudit } from '@/lib/medical/audit-logger';
import { readMedicalSession } from '@/lib/medical/session';

export const dynamic = 'force-dynamic';

function observationStatus(observation: FhirObservation): 'stable' | 'monitoring' | 'critical' {
  const interpretations = observation.interpretation?.flatMap((item) => [item.text, ...(item.coding?.flatMap((coding) => [coding.code, coding.display]) || [])]).filter(Boolean).join(' ').toLowerCase() || '';
  if (/\b(hh|critical|severe|high)\b/.test(interpretations)) return 'critical';
  if (/\b(n|normal|stable)\b/.test(interpretations)) return 'stable';
  return 'monitoring';
}

export async function GET(request: Request) {
  const session = readMedicalSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Professional medical session required' }, { status: 401 });
  const actor = session.sub;
  try {
    const bundle = await new FHIRClient().queryObservations({ _count: '50', _sort: '-date' });
    const observations = (bundle.entry || []).map((entry) => entry.resource).filter(Boolean) as FhirObservation[];
    const patients = observations.map((observation) => {
      const subjectReference = observation.subject?.reference || `Observation/${observation.id || 'unknown'}`;
      return {
        id: pseudonymousId(subjectReference),
        name: 'Identitet i mbrojtur',
        age: null,
        condition: observation.code?.text || observation.code?.coding?.[0]?.display || 'Observation pa etiketë',
        status: observationStatus(observation),
        lastUpdate: observation.effectiveDateTime || observation.issued || null,
      };
    });
    await writeMedicalAudit({ actor, action: 'READ_OBSERVATIONS', resourceType: 'FHIR/Observation', outcome: 'success', ipAddress: clientIp(request) });
    return NextResponse.json({ success: true, data: { patients, systemStatus: { fhir: 'online', records: patients.length } }, source: 'fhir', measuredAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FHIR service unavailable';
    await writeMedicalAudit({ actor, action: 'READ_OBSERVATIONS', resourceType: 'FHIR/Observation', outcome: 'failure', ipAddress: clientIp(request), reason: message });
    return NextResponse.json({ success: false, error: message, state: message.includes('not configured') ? 'unconfigured' : 'unavailable' }, { status: message.includes('not configured') ? 503 : 502 });
  }
}
