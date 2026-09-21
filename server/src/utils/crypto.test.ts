import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, safeEqual } from './crypto';

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext value', () => {
    const value = encrypt('gho_realGitHubAccessTokenLookingString');
    expect(decrypt(value)).toBe('gho_realGitHubAccessTokenLookingString');
  });

  it('produces a different ciphertext and iv on every call (fresh IV per encryption)', () => {
    const a = encrypt('same-plaintext');
    const b = encrypt('same-plaintext');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails to decrypt when the ciphertext has been tampered with', () => {
    const value = encrypt('gho_token');
    const tampered = { ...value, ciphertext: Buffer.from('tampered-ciphertext').toString('base64') };
    expect(() => decrypt(tampered)).toThrow();
  });

  it('fails to decrypt when the auth tag has been tampered with', () => {
    const value = encrypt('gho_token');
    const tampered = { ...value, authTag: Buffer.alloc(16).toString('base64') };
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different-length strings', () => {
    expect(safeEqual('short', 'a-lot-longer')).toBe(false);
  });
});
