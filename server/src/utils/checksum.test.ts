import { describe, expect, it } from 'vitest';
import { computeChecksum } from './checksum';

describe('computeChecksum', () => {
  it('produces the same checksum for identical content', () => {
    expect(computeChecksum('hello world')).toBe(computeChecksum('hello world'));
  });

  it('produces a different checksum when content changes', () => {
    expect(computeChecksum('hello world')).not.toBe(computeChecksum('hello world!'));
  });

  it('produces a 64-character hex sha256 digest', () => {
    expect(computeChecksum('')).toMatch(/^[0-9a-f]{64}$/);
  });
});
