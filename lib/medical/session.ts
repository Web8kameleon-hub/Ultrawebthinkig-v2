import crypto from 'node:crypto';
import { requireEnv } from './config';

const COOKIE_NAME = 'agimed_session';

function signature(payload: string): string {
  return crypto.createHmac('sha256', requireEnv('MEDICAL_SESSION_SECRET')).update(payload).digest('base64url');
}

export function createMedicalSession(subject: string): string {
  const body = Buffer.from(JSON.stringify({ sub: crypto.createHash('sha256').update(subject).digest('hex'), exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${body}.${signature(body)}`;
}

export function readMedicalSession(request: Request): { sub: string } | null {
  try {
    const cookie = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`));
    const token = cookie?.slice(COOKIE_NAME.length + 1);
    if (!token) return null;
    const [body, provided] = token.split('.');
    if (!body || !provided) return null;
    const expected = signature(body);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!data.sub || !data.exp || data.exp <= Date.now()) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}

export const medicalSessionCookie = COOKIE_NAME;
