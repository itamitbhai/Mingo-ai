import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('@clerk/express', () => ({
  getAuth: vi.fn(),
  clerkClient: { users: { getUser: vi.fn() } },
}));

import { getAuth } from '@clerk/express';
import { requireAuth } from './auth.middleware';

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with a 401 ApiError when there is no authenticated Clerk user', () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
    const next = vi.fn();

    requireAuth({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('calls next() with no error when the request is authenticated', () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_123' } as ReturnType<typeof getAuth>);
    const next = vi.fn();

    requireAuth({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});
