import { Types } from 'mongoose';
import { BatchOperationInput, BatchOperationType, IDatabaseOperation, IOperationPreviewResult, LockType } from 'shared';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as batchService from '../../services/workspace/batch.service';
import * as lockService from '../../services/workspace/lock.service';
import * as previewService from '../../services/workspace/preview.service';
import * as snapshotService from '../../services/workspace/snapshot.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';

/**
 * Bridges the Database Agent's validated operations to Phase 4's Virtual Filesystem — mirrors
 * `agents/backend/backend.operations.ts` exactly (spec §31/§35/§67). The Database Agent never calls
 * `fs.writeFile`/`fs.unlink`, and — just as important — never issues a live MongoDB command
 * (`db.dropDatabase()`, `collection.drop()`, `deleteMany`, `updateMany`, a real `mongoose.connect`):
 * every write here targets the *workspace* (generated source files), through the same
 * `preview.service`/`batch.service`/`snapshot.service`/`lock.service` machinery every other agent
 * uses.
 */
function toBatchOperation(op: IDatabaseOperation): BatchOperationInput {
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

export interface DatabaseOperationsPreview {
  preview: IOperationPreviewResult;
  operationsWithDiff: IDatabaseOperation[];
}

/** The model occasionally assumes a conventional file (e.g. a database connection module) already
 *  exists when it doesn't and proposes an "update" for it — repaired into a "create" here rather
 *  than failing the whole task, mirroring `backend.operations.ts`'s `normalizeCreateVsUpdate`. */
async function normalizeCreateVsUpdate(
  owner: Types.ObjectId,
  projectId: string,
  operations: IDatabaseOperation[]
): Promise<IDatabaseOperation[]> {
  return Promise.all(
    operations.map(async (op) => {
      if (op.type !== BatchOperationType.UPDATE) return op;

      const exists = await vfs.readFile(owner, projectId, op.path).then(
        () => true,
        () => false
      );

      return exists ? op : { ...op, type: BatchOperationType.CREATE };
    })
  );
}

/**
 * Validates proposed operations against the *current* workspace state via Phase 4's
 * `preview.service.previewOperations`, and attaches `originalContent` to each operation so the
 * client can render a diff with zero extra requests. Mirrors `backend.operations.ts`'s
 * `previewBackendOperations`.
 */
export async function previewDatabaseOperations(
  owner: Types.ObjectId,
  projectId: string,
  rawOperations: IDatabaseOperation[]
): Promise<DatabaseOperationsPreview> {
  const operations = await normalizeCreateVsUpdate(owner, projectId, rawOperations);
  const batchOps = operations.map(toBatchOperation);
  const preview = await previewService.previewOperations(owner, projectId, batchOps);

  const operationsWithDiff: IDatabaseOperation[] = await Promise.all(
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
  operations: IDatabaseOperation[]
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
 * Applies a validated batch of Database Agent operations as one logical workspace change (spec
 * §35/§67): acquires an `agent` lock on every existing target file, snapshots the workspace, applies
 * the batch via `batch.service.applyBatch`, and restores the snapshot if the apply itself throws
 * partway through — so a schema file never lands without its connection/index files, or vice versa
 * (spec §36). Mirrors `backend.operations.ts`'s `applyBackendOperations`.
 */
export async function applyDatabaseOperations(
  owner: Types.ObjectId,
  projectId: string,
  taskId: string,
  operations: IDatabaseOperation[]
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
      `Before Database Agent task ${taskId}`,
      'Created automatically before applying AI-generated changes.',
      owner
    );

    try {
      return await batchService.applyBatch(owner, projectId, batchOps);
    } catch (err) {
      logger.error('database_agent.apply.failed', { projectId, taskId, error: err instanceof Error ? err.message : err });
      await snapshotService.restoreSnapshot(owner, projectId, snapshot.id).catch((restoreErr) => {
        logger.error('database_agent.rollback.failed', { projectId, taskId, error: restoreErr });
      });
      throw err;
    }
  } finally {
    for (const target of lockTargets) {
      await lockService.releaseLock(target.file, owner).catch(() => undefined);
    }
  }
}
