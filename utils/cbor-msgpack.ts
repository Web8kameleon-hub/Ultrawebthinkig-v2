const NSCBOR_MAGIC = 'NSCB1:';

export type BinaryEncoding = 'cbor' | 'msgpack';

function toUtf8Bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function fromUtf8Bytes(input: Uint8Array): string {
  return new TextDecoder().decode(input);
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeCBOR(payload: unknown): Uint8Array {
  const json = JSON.stringify(payload);
  return toUtf8Bytes(`${NSCBOR_MAGIC}${json}`);
}

export function decodeCBOR<T = unknown>(bytes: Uint8Array): T {
  const raw = fromUtf8Bytes(bytes);
  const json = raw.startsWith(NSCBOR_MAGIC) ? raw.slice(NSCBOR_MAGIC.length) : raw;
  return JSON.parse(json) as T;
}

export function encodeMessage(payload: unknown, encoding: BinaryEncoding): Uint8Array {
  if (encoding === 'msgpack') {
    return encodeCBOR(payload);
  }
  return encodeCBOR(payload);
}

export function decodeMessage<T = unknown>(bytes: Uint8Array, encoding: BinaryEncoding): T {
  if (encoding === 'msgpack') {
    return decodeCBOR<T>(bytes);
  }
  return decodeCBOR<T>(bytes);
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
