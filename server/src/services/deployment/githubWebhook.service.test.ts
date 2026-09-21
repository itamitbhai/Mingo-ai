import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../../config/env';
import { verifyGithubWebhookSignature } from './githubWebhook.service';

function sign(body: Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('verifyGithubWebhookSignature', () => {
  it('accepts a signature computed with the real configured secret', () => {
    const body = Buffer.from(JSON.stringify({ ref: 'refs/heads/main' }));
    const signature = sign(body, env.GITHUB_WEBHOOK_SECRET!);
    expect(() => verifyGithubWebhookSignature(body, signature)).not.toThrow();
  });

  it('rejects a signature computed with the wrong secret', () => {
    const body = Buffer.from(JSON.stringify({ ref: 'refs/heads/main' }));
    const signature = sign(body, 'a-completely-different-secret');
    expect(() => verifyGithubWebhookSignature(body, signature)).toThrow(/invalid webhook signature/i);
  });

  it('rejects a signature for a body that was tampered with after signing', () => {
    const originalBody = Buffer.from(JSON.stringify({ ref: 'refs/heads/main' }));
    const signature = sign(originalBody, env.GITHUB_WEBHOOK_SECRET!);
    const tamperedBody = Buffer.from(JSON.stringify({ ref: 'refs/heads/malicious' }));
    expect(() => verifyGithubWebhookSignature(tamperedBody, signature)).toThrow(/invalid webhook signature/i);
  });

  it('rejects a missing signature header', () => {
    const body = Buffer.from('{}');
    expect(() => verifyGithubWebhookSignature(body, undefined)).toThrow(/missing/i);
  });
});
