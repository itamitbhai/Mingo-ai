import { createHash } from 'node:crypto';

/**
 * SHA-256 content fingerprint used to detect real changes, skip no-op saves, and verify
 * snapshot/version integrity. Never used for authentication (spec §8).
 */
export function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
