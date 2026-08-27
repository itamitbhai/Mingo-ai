import { Types } from 'mongoose';
import { BatchOperationInput, BatchOperationType, FrontendOperationType, IFrontendOperation, IOperationPreviewResult, LockType } from 'shared';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as batchService from '../../services/workspace/batch.service';
import * as lockService from '../../services/workspace/lock.service';
import * as previewService from '../../services/workspace/preview.service';
import * as snapshotService from '../../services/workspace/snapshot.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';

function toBatchOperation(op: IFrontendOperation): BatchOperationInput {
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

export interface FrontendOperationsPreview {
  preview: IOperationPreviewResult;
  operationsWithDiff: IFrontendOperation[];
}

/** The model sometimes gets "create" vs "update" backwards for a path it hasn't seen fully — either
 *  assuming a conventional file (e.g. "src/App.tsx") already exists when it doesn't ("update" on a
 *  missing path), or, on a later task, forgetting an earlier task already created a file it's now
 *  revising ("create" on a path that's already there). The generic preview validator correctly
 *  rejects both, but since a "create" and an "update" both carry the full intended file content,
 *  either mismatch is unambiguous from which way `readFile` resolves — repair it here rather than
 *  failing the whole task and forcing a manual re-run over what the model plainly intended. */
async function normalizeCreateVsUpdate(
  owner: Types.ObjectId,
  projectId: string,
  operations: IFrontendOperation[]
): Promise<IFrontendOperation[]> {
  return Promise.all(
    operations.map(async (op) => {
      if (op.type !== FrontendOperationType.UPDATE && op.type !== FrontendOperationType.CREATE) return op;

      const exists = await vfs.readFile(owner, projectId, op.path).then(
        () => true,
        () => false
      );

      if (op.type === FrontendOperationType.UPDATE) {
        return exists ? op : { ...op, type: FrontendOperationType.CREATE };
      }
      return exists ? { ...op, type: FrontendOperationType.UPDATE } : op;
    })
  );
}

/**
 * Validates proposed operations against the *current* workspace state (spec §19/§21) via Phase
 * 4's `preview.service.previewOperations`, and attaches `originalContent` to each operation so the
 * client can render a diff (existing `DiffViewerDialog`) with zero extra requests.
 */
export async function previewFrontendOperations(
  owner: Types.ObjectId,
  projectId: string,
  rawOperations: IFrontendOperation[]
): Promise<FrontendOperationsPreview> {
  const operations = await normalizeCreateVsUpdate(owner, projectId, rawOperations);
  const batchOps = operations.map(toBatchOperation);
  const preview = await previewService.previewOperations(owner, projectId, batchOps);

  const operationsWithDiff: IFrontendOperation[] = await Promise.all(
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
  operations: IFrontendOperation[]
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
 * Applies a validated batch of Frontend Agent operations as one logical workspace change (spec
 * §27/§28): acquires an `agent` lock on every existing target file, snapshots the workspace,
 * applies the batch via `batch.service.applyBatch`, and restores the snapshot if the apply itself
 * throws partway through. Locks are always released, on both success and failure.
 */
export async function applyFrontendOperations(
  owner: Types.ObjectId,
  projectId: string,
  taskId: string,
  operations: IFrontendOperation[]
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
      `Before Frontend Agent task ${taskId}`,
      'Created automatically before applying AI-generated changes.',
      owner
    );

    try {
      return await batchService.applyBatch(owner, projectId, batchOps);
    } catch (err) {
      logger.error('frontend_agent.apply.failed', { projectId, taskId, error: err instanceof Error ? err.message : err });
      await snapshotService.restoreSnapshot(owner, projectId, snapshot.id).catch((restoreErr) => {
        logger.error('frontend_agent.rollback.failed', { projectId, taskId, error: restoreErr });
      });
      throw err;
    }
  } finally {
    for (const target of lockTargets) {
      await lockService.releaseLock(target.file, owner).catch(() => undefined);
    }
  }
}
