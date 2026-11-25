import { NextRequest, NextResponse } from 'next/server';
import { clientIp, requireHttpUrl } from '@/lib/medical/config';
import { writeMedicalAudit } from '@/lib/medical/audit-logger';
import { readMedicalSession } from '@/lib/medical/session';

const DICOM_UID = /^\d+(?:\.\d+)+$/;

export async function POST(request: NextRequest) {
  const session = readMedicalSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Professional medical session required' }, { status: 401 });
  const actor = session.sub;
  try {
    const body = await request.json() as { studyInstanceUid?: unknown };
    const studyInstanceUid = typeof body.studyInstanceUid === 'string' ? body.studyInstanceUid.trim() : '';
    if (!DICOM_UID.test(studyInstanceUid) || studyInstanceUid.length > 128) return NextResponse.json({ success: false, error: 'A valid StudyInstanceUID is required' }, { status: 400 });
    const pacs = requireHttpUrl('PACS_DICOMWEB_URL');
    const engine = requireHttpUrl('AGI_MED_ENGINE_URL');
    const instancesUrl = new URL(`${pacs.toString().replace(/\/$/, '')}/studies/${encodeURIComponent(studyInstanceUid)}/instances`);
    const pacsResponse = await fetch(instancesUrl, { headers: { accept: 'application/dicom+json' }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!pacsResponse.ok) throw new Error(`PACS returned ${pacsResponse.status}`);
    const instances = await pacsResponse.json();
    if (!Array.isArray(instances)) throw new Error('PACS returned invalid DICOM metadata');
    const aiResponse = await fetch(new URL('/v1/diagnostics/analyze-study', engine), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...(process.env.AGI_MED_API_KEY ? { 'x-api-key': process.env.AGI_MED_API_KEY } : {}) }, body: JSON.stringify({ studyInstanceUid, instancesCount: instances.length }), signal: AbortSignal.timeout(60_000) });
    if (!aiResponse.ok) throw new Error(`AGI diagnostics engine returned ${aiResponse.status}`);
    const result = await aiResponse.json();
    await writeMedicalAudit({ actor, action: 'ANALYZE_DICOM_STUDY', resourceType: 'DICOM/Study', outcome: 'success', ipAddress: clientIp(request) });
    return NextResponse.json({ success: true, studyInstanceUid, result, measuredAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Diagnostics service unavailable';
    await writeMedicalAudit({ actor, action: 'ANALYZE_DICOM_STUDY', resourceType: 'DICOM/Study', outcome: 'failure', ipAddress: clientIp(request), reason: message });
    return NextResponse.json({ success: false, error: message }, { status: message.includes('not configured') ? 503 : 502 });
  }
}
