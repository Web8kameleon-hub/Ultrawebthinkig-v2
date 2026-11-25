import { NextRequest, NextResponse } from 'next/server';
import { clientIp, requireHttpUrl } from '@/lib/medical/config';
import { writeMedicalAudit } from '@/lib/medical/audit-logger';
import { createMedicalSession, medicalSessionCookie } from '@/lib/medical/session';

export async function POST(request: NextRequest) {
  const ipAddress = clientIp(request);
  let auditActor = 'unknown';
  try {
    const body = await request.json() as { licenseNumber?: unknown; doctorNid?: unknown; email?: unknown };
    const licenseNumber = typeof body.licenseNumber === 'string' ? body.licenseNumber.trim() : '';
    const doctorNid = typeof body.doctorNid === 'string' ? body.doctorNid.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    auditActor = doctorNid || 'unknown';
    if (!licenseNumber || !doctorNid || licenseNumber.length > 80 || doctorNid.length > 40) return NextResponse.json({ success: false, accessGranted: false, error: 'License number and NID are required' }, { status: 400 });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ success: false, accessGranted: false, error: 'Professional email is invalid' }, { status: 400 });
    const response = await fetch(requireHttpUrl('MEDICAL_REGISTRY_API_URL'), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...(process.env.REGISTRY_API_KEY ? { authorization: `Bearer ${process.env.REGISTRY_API_KEY}` } : {}) }, body: JSON.stringify({ license_number: licenseNumber, nid: doctorNid, ...(email ? { email } : {}) }), cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Medical registry returned ${response.status}`);
    const verification = await response.json();
    const accessGranted = verification?.status === 'ACTIVE';
    await writeMedicalAudit({ actor: auditActor, action: 'VERIFY_MEDICAL_LICENSE', resourceType: 'MedicalLicense', outcome: accessGranted ? 'success' : 'denied', ipAddress });
    if (!accessGranted) return NextResponse.json({ success: false, accessGranted: false, status: verification?.status || 'UNKNOWN', error: 'License is not active' }, { status: 403 });
    const result = NextResponse.json({ success: true, accessGranted: true, doctor: { name: verification.full_name || null, specialty: verification.specialty || null, licenseNumber: verification.license_number || licenseNumber, expirationDate: verification.expiration_date || null, verifiedAt: new Date().toISOString() } });
    result.cookies.set(medicalSessionCookie, createMedicalSession(doctorNid), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Medical registry unavailable';
    await writeMedicalAudit({ actor: auditActor, action: 'VERIFY_MEDICAL_LICENSE', resourceType: 'MedicalLicense', outcome: 'failure', ipAddress, reason: message });
    return NextResponse.json({ success: false, accessGranted: false, error: message }, { status: message.includes('not configured') ? 503 : 502 });
  }
}
