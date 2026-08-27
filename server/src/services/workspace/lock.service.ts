import { Types } from 'mongoose';
import { LockType } from 'shared';
import { WorkspaceLockModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { workspaceConfig } from '../../config/workspace.config';

/**
 * Locking foundation for AI agents/collaborators (spec §27). Enforced on every agent's apply path —
 * each agent's own `*.operations.ts` (`applyFrontendOperations`, `applyBackendOperations`,
 * `applyDatabaseOperations`, `applyTestingOperations`) acquires a `LockType.AGENT` lock on every
 * existing target file before snapshotting/batch-applying, and releases it in a `finally` — so two
 * concurrent writers to the same file (e.g. the Phase 10 Orchestrator running two agents in parallel)
 * genuinely conflict here rather than silently racing. Locks always expire via the model's TTL index,
 * so they can never go stale permanently even if a caller forgets to release one.
 */
export async function acquireLock(
  project: Types.ObjectId,
  file: Types.ObjectId,
  lockedBy: Types.ObjectId,
  lockType: LockType = LockType.USER,
  ttlMs: number = workspaceConfig.LOCK_TTL_MS
) {
  const existing = await WorkspaceLockModel.findOne({ file });

  if (existing && existing.expiresAt > new Date() && existing.lockedBy.toString() !== lockedBy.toString()) {
    throw ApiError.conflict('This file is locked by another session');
  }

  const expiresAt = new Date(Date.now() + ttlMs);

  if (existing) {
    existing.lockedBy = lockedBy;
    existing.lockType = lockType;
    existing.expiresAt = expiresAt;
    await existing.save();
    return existing;
  }

  return WorkspaceLockModel.create({ project, file, lockedBy, lockType, expiresAt });
}

export async function releaseLock(file: Types.ObjectId, releasedBy: Types.ObjectId) {
  await WorkspaceLockModel.deleteOne({ file, lockedBy: releasedBy });
}

export async function isLocked(file: Types.ObjectId): Promise<boolean> {
  const lock = await WorkspaceLockModel.findOne({ file, expiresAt: { $gt: new Date() } });
  return Boolean(lock);
}

export async function refreshLock(
  file: Types.ObjectId,
  lockedBy: Types.ObjectId,
  ttlMs: number = workspaceConfig.LOCK_TTL_MS
) {
  const lock = await WorkspaceLockModel.findOne({ file, lockedBy });

  if (!lock) {
    throw ApiError.notFound('No active lock to refresh');
  }

  lock.expiresAt = new Date(Date.now() + ttlMs);
  await lock.save();
  return lock;
}
