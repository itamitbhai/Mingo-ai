import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRateLimiter, MemoryRateLimitStore } from './rateLimit.middleware';

describe('MemoryRateLimitStore', () => {
  it('increments the count per key on each hit', async () => {
    const store = new MemoryRateLimitStore();

    const first = await store.hit('user-1', 60_000, 2);
    const second = await store.hit('user-1', 60_000, 2);
    const third = await store.hit('user-1', 60_000, 2);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(third.count).toBe(3);
    expect(third.remaining).toBe(0);
  });

  it('tracks separate counters per key', async () => {
    const store = new MemoryRateLimitStore();

    await store.hit('a', 60_000, 1);
    const b = await store.hit('b', 60_000, 1);

    expect(b.count).toBe(1);
  });

  it('resets the counter once the window has elapsed', async () => {
    const store = new MemoryRateLimitStore();

    await store.hit('user-1', 10, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterWindow = await store.hit('user-1', 10, 1);

    expect(afterWindow.count).toBe(1);
  });
});

describe('createRateLimiter', () => {
  it('allows requests under the limit and rejects with a 429 once exceeded', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyFn: () => 'same-key' });
    const req = {} as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;

    const firstNext = vi.fn();
    await limiter(req, res, firstNext);
    expect(firstNext).toHaveBeenCalledWith();

    const secondNext = vi.fn();
    await limiter(req, res, secondNext);
    expect(secondNext).toHaveBeenCalledTimes(1);
    const err = secondNext.mock.calls[0][0];
    expect(err).toMatchObject({ statusCode: 429 });
  });
});
