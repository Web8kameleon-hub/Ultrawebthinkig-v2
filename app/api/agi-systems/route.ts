import { NextResponse } from 'next/server';
import { clientIp, requireHttpUrl } from '@/lib/medical/config';
import { writeMedicalAudit } from '@/lib/medical/audit-logger';
import { readMedicalSession } from '@/lib/medical/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = readMedicalSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Professional medical session required' }, { status: 401 });
  const actor = session.sub;
  try {
    const response = await fetch(new URL('/v1/systems/all-status', requireHttpUrl('AGI_MED_ENGINE_URL')), {
      headers: { accept: 'application/json', ...(process.env.AGI_MED_API_KEY ? { 'x-api-key': process.env.AGI_MED_API_KEY } : {}) },
      cache: 'no-store', signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`AGI Med engine returned ${response.status}`);
    const raw = await response.json();
    const systems = Array.isArray(raw) ? raw : raw?.systems;
    if (!Array.isArray(systems)) throw new Error('AGI Med engine returned an invalid systems payload');
    const normalized = systems.map((system: Record<string, unknown>) => ({ id: String(system.id), name: String(system.name), status: String(system.status), accuracy: typeof system.accuracy === 'number' ? system.accuracy : null, description: typeof system.description === 'string' ? system.description : null, category: typeof system.category === 'string' ? system.category : null, lastUpdate: typeof system.lastUpdate === 'string' ? system.lastUpdate : null }));
    await writeMedicalAudit({ actor, action: 'READ_SYSTEM_STATUS', resourceType: 'AGI/Systems', outcome: 'success', ipAddress: clientIp(request) });
    return NextResponse.json({ success: true, systems: normalized, measuredAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AGI Med engine unavailable';
    await writeMedicalAudit({ actor, action: 'READ_SYSTEM_STATUS', resourceType: 'AGI/Systems', outcome: 'failure', ipAddress: clientIp(request), reason: message });
    return NextResponse.json({ success: false, error: message }, { status: message.includes('not configured') ? 503 : 502 });
  }
}
