import { Types } from 'mongoose';
import { BatchOperationInput, BatchOperationType, IBackendOperation, IOperationPreviewResult, LockType } from 'shared';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as batchService from '../../services/workspace/batch.service';
import * as lockService from '../../services/workspace/lock.service';
import * as previewService from '../../services/workspace/preview.service';
import * as snapshotService from '../../services/workspace/snapshot.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';

/**
 * Bridges the Backend Agent's validated operations to Phase 4's Virtual Filesystem — mirrors
 * `agents/frontend/frontend.operations.ts` exactly (spec §26/§33/§64). The Backend Agent never
 * calls `fs.writeFile`/`fs.unlink` or any direct filesystem/database API; every write goes through
 * `preview.service`/`batch.service`/`snapshot.service`/`lock.service`, the same Phase 4 machinery
 * the Frontend Agent and the Browser IDE's own Batch Operations dialog use.
 */
function toBatchOperation(op: IBackendOperation): BatchOperationInput {
  switch (op.type) {
    case BatchOperationType.CREATE:
      return { type: BatchOperationType.CREATE, path: op.path, content: op.content ?? '' };
    case BatchOperationType.UPDATE:
      return { type: BatchOperationType.UPDATE, path: op.path, content: op.content ?? '' };
    case BatchOperationType.DELETE:
      return { type: BatchOperationType.DELETE, path: op.path };
    case BatchOperationType.RENAME:
      return { type: BatchOperationType.RENAME, path: op.path, newName: op.newName ?? '' };
    case BatchOperationType.MOVE:
      return { type: BatchOperationType.MOVE, path: op.path, destinationPath: op.destinationPath ?? '' };
    default:
      throw ApiError.badRequest(`Unsupported operation type`);
  }
}

async function readCurrentContent(
  owner: Types.ObjectId,
  projectId: string,
  path: string
): Promise<string | undefined> {
  return vfs.readFile(owner, projectId, path).then(
    (file) => file.content,
    () => undefined
  );
}

export interface BackendOperationsPreview {
  preview: IOperationPreviewResult;
  operationsWithDiff: IBackendOperation[];
}

/** The model sometimes gets "create" vs "update" backwards for a path it hasn't seen fully — either
 *  assuming a conventional file (e.g. a server entry point) already exists when it doesn't ("update"
 *  on a missing path), or forgetting an earlier task already created a file it's now revising
 *  ("create" on a path that's already there). Since a "create" and an "update" both carry the full
 *  intended file content, either mismatch is unambiguous from which way `readFile` resolves — repair
 *  it here rather than failing the whole task over it. Mirrors `frontend.operations.ts`'s
 *  `normalizeCreateVsUpdate`. */
async function normalizeCreateVsUpdate(
  owner: Types.ObjectId,
  projectId: string,
  operations: IBackendOperation[]
): Promise<IBackendOperation[]> {
  return Promise.all(
    operations.map(async (op) => {
      if (op.type !== BatchOperationType.UPDATE && op.type !== BatchOperationType.CREATE) return op;

      const exists = await vfs.readFile(owner, projectId, op.path).then(
        () => true,
        () => false
      );

      if (op.type === BatchOperationType.UPDATE) {
        return exists ? op : { ...op, type: BatchOperationType.CREATE };
      }
      return exists ? { ...op, type: BatchOperationType.UPDATE } : op;
    })
  );
}

/**
 * Validates proposed operations against the *current* workspace state via Phase 4's
 * `preview.service.previewOperations`, and attaches `originalContent` to each operation so the
 * client can render a diff (existing `DiffViewerDialog`) with zero extra requests. Mirrors
 * `frontend.operations.ts`'s `previewFrontendOperations`.
 */
export async function previewBackendOperations(
  owner: Types.ObjectId,
  projectId: string,
  rawOperations: IBackendOperation[]
): Promise<BackendOperationsPreview> {
  const operations = await normalizeCreateVsUpdate(owner, projectId, rawOperations);
  const batchOps = operations.map(toBatchOperation);
  const preview = await previewService.previewOperations(owner, projectId, batchOps);

  const operationsWithDiff: IBackendOperation[] = await Promise.all(
    operations.map(async (op) => {
      if (op.type === BatchOperationType.CREATE) {
        return { ...op, originalContent: '' };
      }
      const originalContent = await readCurrentContent(owner, projectId, op.path);
      return { ...op, originalContent: originalContent ?? '' };
    })
  );

  return { preview, operationsWithDiff };
}

interface LockTarget {
  project: Types.ObjectId;
  file: Types.ObjectId;
}

async function resolveLockTargets(
  owner: Types.ObjectId,
  projectId: string,
  operations: IBackendOperation[]
): Promise<LockTarget[]> {
  const targets = operations.filter((op) => op.type !== BatchOperationType.CREATE).map((op) => op.path);
  const locks: LockTarget[] = [];

  for (const path of targets) {
    const file = await vfs.readFile(owner, projectId, path).catch(() => null);
    if (file) locks.push({ project: file.project as Types.ObjectId, file: file._id as Types.ObjectId });
  }

  return locks;
}

/**
 * Applies a validated batch of Backend Agent operations as one logical workspace change (spec
 * §33/§64): acquires an `agent` lock on every existing target file, snapshots the workspace, applies
 * the batch via `batch.service.applyBatch`, and restores the snapshot if the apply itself throws
 * partway through. Locks are always released, on both success and failure. Mirrors
 * `frontend.operations.ts`'s `applyFrontendOperations`.
 */
export async function applyBackendOperations(
  owner: Types.ObjectId,
  projectId: string,
  taskId: string,
  operations: IBackendOperation[]
) {
  const batchOps = operations.map(toBatchOperation);
  const lockTargets = await resolveLockTargets(owner, projectId, operations);

  for (const target of lockTargets) {
    await lockService.acquireLock(target.project, target.file, owner, LockType.AGENT);
  }

  try {
    const snapshot = await snapshotService.createSnapshot(
      owner,
      projectId,
      `Before Backend Agent task ${taskId}`,
      'Created automatically before applying AI-generated changes.',
      owner
    );

    try {
      return await batchService.applyBatch(owner, projectId, batchOps);
    } catch (err) {
      logger.error('backend_agent.apply.failed', { projectId, taskId, error: err instanceof Error ? err.message : err });
      await snapshotService.restoreSnapshot(owner, projectId, snapshot.id).catch((restoreErr) => {
        logger.error('backend_agent.rollback.failed', { projectId, taskId, error: restoreErr });
      });
      throw err;
    }
  } finally {
    for (const target of lockTargets) {
      await lockService.releaseLock(target.file, owner).catch(() => undefined);
    }
  }
}
