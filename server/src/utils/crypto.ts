import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/** Lazily resolved so a missing/malformed key surfaces as a normal env-validation failure at boot
 *  (see `config/env.ts`), never as a crash the first time a GitHub token happens to be encrypted. */
function getKey(): Buffer {
  return Buffer.from(env.GITHUB_TOKEN_ENCRYPTION_KEY, 'base64');
}

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * AES-256-GCM encryption for secrets at rest (Phase 12 spec §5/§23 — GitHub access tokens must
 * never be stored in plaintext). A fresh random IV is generated per call; GCM's auth tag is
 * returned alongside so tampering with either the ciphertext or IV is detected on decrypt rather
 * than silently producing garbage.
 */
export function encrypt(plaintext: string): EncryptedValue {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decrypt(value: EncryptedValue): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Constant-time equality for comparing OAuth `state` values (CSRF protection) — a timing-sensitive
 *  `===` here would leak how many leading bytes matched. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
