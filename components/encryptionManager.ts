import crypto from "crypto";

// ─── Tipi publik i kontekstit ───────────────────────────────────────────────
export interface Web8EncryptionContext {
  key: string;
  algorithm: 'aes-256-cbc';
  createdAt: number;
}

// ─── Funksione standalone (për advanced-security/page.tsx) ──────────────────

/** Gjeneron çelës të ri AES-256 (Base64 44 karaktere) */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/** Krijon kontekstin e enkriptimit nga çelësi */
export function createEncryptionContext(key: string): Web8EncryptionContext {
  return { key, algorithm: 'aes-256-cbc', createdAt: Date.now() };
}

/** Enkripton tekst duke përdorur kontekstin */
export function encryptText(text: string, ctx: Web8EncryptionContext | null | undefined): string {
  if (!ctx) throw new Error('Encryption context missing');
  const keyBuf = Buffer.from(ctx.key, 'base64');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('base64');
}

/** Dekripton tekst duke përdorur kontekstin */
export function decryptText(encrypted: string, ctx: Web8EncryptionContext | null | undefined): string {
  if (!ctx) throw new Error('Encryption context missing');
  const [ivHex, data] = encrypted.split(':');
  const keyBuf = Buffer.from(ctx.key, 'base64');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * EncryptionManager - Një klasë për menaxhimin e enkriptimit dhe dekriptimit.
 * Siguron funksionalitete për të ruajtur dhe përdorur çelësat e enkriptimit.
 */
export class EncryptionManager {
  private readonly encryptionKey: Buffer;
  private readonly iv: Buffer;

  constructor(key: string) {
    if (key.length !== 44) {
      throw new Error("Çelësi duhet të jetë një string Base64 me gjatësi 44 karaktere.");
    }
    this.encryptionKey = Buffer.from(key, "base64");
    this.iv = Buffer.alloc(16, 0); // Vektor inicializimi (IV) i paracaktuar
  }

  /**
   * Enkripton një tekst të dhënë.
   * @param text Teksti për enkriptim.
   * @returns Teksti i enkriptuar në format Base64.
   */
  encrypt(text: string): string {
    const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, this.iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }

  /**
   * Dekripton një tekst të enkriptuar.
   * @param encrypted Teksti i enkriptuar në format Base64.
   * @returns Teksti i dekriptuar.
   */
  decrypt(encrypted: string): string {
    const decipher = crypto.createDecipheriv("aes-256-cbc", this.encryptionKey, this.iv);
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Gjeneron një çelës të ri enkriptimi në format Base64.
   * @returns Një çelës i ri enkriptimi.
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString("base64");
  }
}

// Shembull përdorimi
const encryptionKey = EncryptionManager.generateKey(); // Gjenero një çelës të ri
const manager = new EncryptionManager(encryptionKey);

const text = "Ultrawebthinking është e ardhmja!";
const encrypted = manager.encrypt(text);
console.log("Teksti i enkriptuar:", encrypted);

const decrypted = manager.decrypt(encrypted);
console.log("Teksti i dekriptuar:", decrypted);
