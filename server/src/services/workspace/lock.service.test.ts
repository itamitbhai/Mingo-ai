import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { LockType } from 'shared';

vi.mock('../../models', () => ({
  WorkspaceLockModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

import { WorkspaceLockModel } from '../../models';
import { acquireLock, isLocked, refreshLock, releaseLock } from './lock.service';

describe('lock.service', () => {
  const project = new Types.ObjectId();
  const file = new Types.ObjectId();
  const userA = new Types.ObjectId();
  const userB = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('creates a new lock when none exists', async () => {
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue(null);
      vi.mocked(WorkspaceLockModel.create).mockResolvedValue({ lockedBy: userA } as never);

      await acquireLock(project, file, userA);

      expect(WorkspaceLockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ project, file, lockedBy: userA, lockType: LockType.USER })
      );
    });

    it('rejects when another session holds a still-active lock', async () => {
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue({
        lockedBy: userB,
        expiresAt: new Date(Date.now() + 60_000),
      } as never);

      await expect(acquireLock(project, file, userA)).rejects.toMatchObject({ statusCode: 409 });
      expect(WorkspaceLockModel.create).not.toHaveBeenCalled();
    });

    it('allows re-acquiring an expired lock even if held by someone else', async () => {
      const expired = {
        lockedBy: userB,
        expiresAt: new Date(Date.now() - 1_000),
        lockType: LockType.USER,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue(expired as never);

      const result = await acquireLock(project, file, userA);

      expect(expired.save).toHaveBeenCalled();
      expect(result).toBe(expired);
      expect((result as unknown as { lockedBy: Types.ObjectId }).lockedBy).toBe(userA);
    });

    it('lets the same session re-acquire (refresh) its own active lock', async () => {
      const own = {
        lockedBy: userA,
        expiresAt: new Date(Date.now() + 60_000),
        lockType: LockType.USER,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue(own as never);

      await acquireLock(project, file, userA);

      expect(own.save).toHaveBeenCalled();
    });
  });

  describe('isLocked', () => {
    it('is true only when a non-expired lock exists', async () => {
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue({ _id: new Types.ObjectId() } as never);
      await expect(isLocked(file)).resolves.toBe(true);

      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue(null);
      await expect(isLocked(file)).resolves.toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('deletes only the caller-owned lock', async () => {
      vi.mocked(WorkspaceLockModel.deleteOne).mockResolvedValue({ deletedCount: 1 } as never);

      await releaseLock(file, userA);

      expect(WorkspaceLockModel.deleteOne).toHaveBeenCalledWith({ file, lockedBy: userA });
    });
  });

  describe('refreshLock', () => {
    it('throws a 404 when there is no active lock to refresh', async () => {
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue(null);

      await expect(refreshLock(file, userA)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('pushes the expiry forward for an existing lock', async () => {
      const lock = { expiresAt: new Date(Date.now() - 1_000), save: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(WorkspaceLockModel.findOne).mockResolvedValue(lock as never);

      await refreshLock(file, userA);

      expect(lock.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(lock.save).toHaveBeenCalled();
    });
  });
});
