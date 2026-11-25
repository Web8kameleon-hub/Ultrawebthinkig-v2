import crypto from 'node:crypto';

export function pseudonymousId(id: string): string {
  const salt = process.env.MEDICAL_PSEUDONYM_SALT;
  if (!salt) throw new Error('MEDICAL_PSEUDONYM_SALT is not configured');
  return `anon-${crypto.createHmac('sha256', salt).update(id).digest('hex').slice(0, 16)}`;
}

export function yearFromBirthDate(value?: string): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}
