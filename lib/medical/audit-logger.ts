import crypto from 'node:crypto';

export type MedicalAuditEvent = {
  actor: string;
  action: string;
  resourceType: string;
  outcome: 'success' | 'failure' | 'denied';
  ipAddress: string;
  reason?: string;
};

function pseudonymize(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 20);
}

export async function writeMedicalAudit(event: MedicalAuditEvent): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    actorHash: pseudonymize(event.actor || 'anonymous'),
    action: event.action,
    resourceType: event.resourceType,
    outcome: event.outcome,
    sourceIpHash: pseudonymize(event.ipAddress || 'unknown'),
    reason: event.reason,
  };

  const sink = process.env.AUDIT_LOG_SERVER_URL?.trim();
  if (!sink) {
    console.info('[MEDICAL_AUDIT]', JSON.stringify(entry));
    return;
  }

  try {
    const response = await fetch(sink, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.AUDIT_LOG_API_KEY ? { authorization: `Bearer ${process.env.AUDIT_LOG_API_KEY}` } : {}),
      },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) console.error(`[MEDICAL_AUDIT] sink returned ${response.status}`);
  } catch (error) {
    console.error('[MEDICAL_AUDIT] sink unavailable', error instanceof Error ? error.message : 'unknown error');
  }
}
