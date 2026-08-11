import { Request, RequestHandler } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { getCurrentUser } from '../utils/getCurrentUser';

export interface RateLimitHit {
  count: number;
  remaining: number;
  resetAt: number;
}

/**
 * Storage boundary for rate-limit counters. `MemoryRateLimitStore` below is the
 * only implementation today; swapping in Redis for multi-instance deployments
 * means writing one new class here — call sites never change.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, max: number): Promise<RateLimitHit>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitHit> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.counters.set(key, { count: 1, resetAt });
      return { count: 1, remaining: max - 1, resetAt };
    }

    existing.count += 1;
    return { count: existing.count, remaining: Math.max(max - existing.count, 0), resetAt: existing.resetAt };
  }
}

interface CreateRateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  store?: RateLimitStore;
  keyFn?: (req: Request) => string;
}

export function createRateLimiter({
  windowMs,
  max,
  message = 'Too many requests. Please slow down and try again shortly.',
  store = new MemoryRateLimitStore(),
  keyFn = (req) => getCurrentUser(req)._id.toString(),
}: CreateRateLimiterOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = keyFn(req);
      const result = await store.hit(key, windowMs, max);

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));

      if (result.count > max) {
        throw new ApiError(429, message);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const aiMessageRateLimiter = createRateLimiter({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX_REQUESTS,
  message: 'You are sending messages too quickly. Please wait a moment and try again.',
});

/** Plan generation is an expensive, multi-attempt AI call — rate-limited separately and more
 *  tightly than a single chat message (spec §59). */
export const plannerRateLimiter = createRateLimiter({
  windowMs: env.PLANNER_RATE_LIMIT_WINDOW_MS,
  max: env.PLANNER_RATE_LIMIT_MAX_REQUESTS,
  message: 'You are generating plans too quickly. Please wait a few minutes and try again.',
});

/** Frontend Agent task execution/regeneration is an expensive, multi-attempt AI + code-generation
 *  call — rate-limited the same way as plan generation (Phase 6 spec §69). */
export const frontendAgentRateLimiter = createRateLimiter({
  windowMs: env.FRONTEND_AGENT_RATE_LIMIT_WINDOW_MS,
  max: env.FRONTEND_AGENT_RATE_LIMIT_MAX_REQUESTS,
  message: 'You are running the Frontend Agent too quickly. Please wait a few minutes and try again.',
});
