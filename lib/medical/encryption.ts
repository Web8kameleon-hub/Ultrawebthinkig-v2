import crypto from 'node:crypto';
import { requireEnv } from './config';

function masterKey(): Buffer {
  const hex = requireEnv('E2EE_MASTER_KEY_HEX');
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('E2EE_MASTER_KEY_HEX must contain exactly 32 bytes encoded as 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
}

export type EncryptedPayload = {
  algorithm: 'aes-256-gcm';
  ciphertext: string;
  nonce: string;
  tag: string;
};

export function encryptPHI(value: unknown): EncryptedPayload {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64url'),
    nonce: nonce.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

export function decryptPHI(payload: EncryptedPayload): unknown {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey(),
    Buffer.from(payload.nonce, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}
