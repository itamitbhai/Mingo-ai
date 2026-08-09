import { Types } from 'mongoose';
import { BatchOperationType, IBatchOperationOutcome, IBatchOperationResult } from 'shared';
import { ApiError } from '../../utils/ApiError';
import * as fileService from '../files/file.service';
import { moveEntry } from './move.service';
import { planOperations, PlannedOperation } from './preview.service';

async function applyOne(
  owner: Types.ObjectId,
  projectId: string,
  entry: PlannedOperation
): Promise<IBatchOperationOutcome> {
  const { op } = entry;

  if (entry.action === 'CREATE') {
    const file = entry.isFolder
      ? await fileService.createFolder(owner, projectId, entry.targetPath)
      : await fileService.createFile(
          owner,
          projectId,
          entry.targetPath,
          op.type === BatchOperationType.CREATE ? (op.content ?? '') : ''
        );
    return { ...op, status: 'created', file: file.toJSON() as unknown as IBatchOperationOutcome['file'] };
  }

  if (entry.action === 'DELETE') {
    await fileService.deleteEntry(owner, projectId, entry.targetPath);
    return { ...op, status: 'deleted' };
  }

  // MODIFY
  if (op.type === BatchOperationType.UPDATE) {
    const file = await fileService.updateFileContent(owner, projectId, op.path, op.content);
    return { ...op, status: 'updated', file: file.toJSON() as unknown as IBatchOperationOutcome['file'] };
  }

  if (op.type === BatchOperationType.RENAME) {
    const file = await fileService.renameEntry(owner, projectId, op.path, op.newName);
    return { ...op, status: 'renamed', file: file.toJSON() as unknown as IBatchOperationOutcome['file'] };
  }

  if (op.type === BatchOperationType.MOVE) {
    const { entry: file } = await moveEntry(owner, projectId, op.path, op.destinationPath);
    return { ...op, status: 'moved', file: file.toJSON() as unknown as IBatchOperationOutcome['file'] };
  }

  throw ApiError.internal('Unreachable batch operation type');
}

/**
 * Applies a validated batch of operations as one logical workspace change (spec §23/§24). Every
 * operation is fully validated up front by `planOperations` — creating/updating/deleting/
 * renaming/moving — and the whole batch is rejected if any single operation would fail, so a
 * partially-applied batch should never happen in practice. Individual writes still go through
 * `file.service`/`move.service` (which is what gives every batched change its own version +
 * activity history for free) rather than a raw bulk write, so this isn't wrapped in a single
 * MongoDB transaction — full session-threaded atomicity across every service call is a larger
 * refactor left for when the sandbox/AI-agent phases need it.
 */
export async function applyBatch(
  owner: Types.ObjectId,
  projectId: string,
  operations: Parameters<typeof planOperations>[2]
): Promise<IBatchOperationResult> {
  const { plan, errors, conflicts } = await planOperations(owner, projectId, operations);

  if (errors.length > 0 || conflicts.length > 0) {
    throw ApiError.badRequest('Batch validation failed — no changes were applied', {
      errors,
      conflicts,
    });
  }

  const outcomes: IBatchOperationOutcome[] = [];
  for (const entry of plan) {
    outcomes.push(await applyOne(owner, projectId, entry));
  }

  return { applied: outcomes.length, operations: outcomes };
}
