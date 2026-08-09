import { Types } from 'mongoose';
import { BatchOperationInput, BatchOperationType, FileEntryType, IOperationPreviewResult } from 'shared';
import { ProjectFileDocument, ProjectFileModel } from '../../models';
import { workspaceConfig } from '../../config/workspace.config';
import { getProjectById } from '../project.service';
import { assertSafePath, getParentPath } from './path.service';

export interface PlannedOperation {
  op: BatchOperationInput;
  action: 'CREATE' | 'MODIFY' | 'DELETE';
  targetPath: string;
  existing: ProjectFileDocument | null;
  isFolder?: boolean;
}

export interface OperationPlan {
  project: Awaited<ReturnType<typeof getProjectById>>;
  plan: PlannedOperation[];
  warnings: string[];
  errors: string[];
  conflicts: string[];
}

function getAncestorPaths(path: string): string[] {
  const segments = path.split('/');
  const ancestors: string[] = [];
  for (let i = 1; i < segments.length; i++) {
    ancestors.push(segments.slice(0, i).join('/'));
  }
  return ancestors;
}

/**
 * Validates a batch of operations against the project's *current* state without writing anything
 * — the same planning logic backs both the preview endpoint (read-only) and the apply endpoint
 * (spec §25: "validate operations without applying them"). Missing parent folders for creates/moves
 * are auto-synthesized as their own CREATE-folder plan entries so an AI agent can create
 * `src/auth/auth.service.ts` without pre-creating `src/auth` (spec §23/§24).
 */
export async function planOperations(
  owner: Types.ObjectId,
  projectId: string,
  operations: BatchOperationInput[]
): Promise<OperationPlan> {
  const project = await getProjectById(owner, projectId);
  const warnings: string[] = [];
  const errors: string[] = [];
  const conflicts: string[] = [];

  if (operations.length > workspaceConfig.MAX_BATCH_OPERATIONS) {
    errors.push(`A batch may contain at most ${workspaceConfig.MAX_BATCH_OPERATIONS} operations`);
  }

  const existingFiles = await ProjectFileModel.find({ project: project._id, owner }).select('-content');
  const existingByPath = new Map(existingFiles.map((file) => [file.path, file]));
  const claimedPaths = new Set<string>();
  const foldersToCreate = new Set<string>();
  const plan: PlannedOperation[] = [];

  const claim = (path: string, label: string): boolean => {
    if (claimedPaths.has(path)) {
      conflicts.push(`Multiple operations target "${path}" (${label})`);
      return false;
    }
    claimedPaths.add(path);
    return true;
  };

  for (const op of operations) {
    let path: string;
    try {
      path = assertSafePath(op.path);
    } catch {
      errors.push(`Invalid path: "${op.path}"`);
      continue;
    }

    const existing = existingByPath.get(path) ?? null;

    switch (op.type) {
      case BatchOperationType.CREATE: {
        if (existing) {
          conflicts.push(`"${path}" already exists`);
          continue;
        }
        if (op.content && Buffer.byteLength(op.content, 'utf8') > workspaceConfig.MAX_FILE_SIZE_BYTES) {
          errors.push(`"${path}" exceeds the maximum file size`);
          continue;
        }
        if (!claim(path, 'create')) continue;
        for (const ancestor of getAncestorPaths(path)) {
          if (!existingByPath.has(ancestor)) foldersToCreate.add(ancestor);
        }
        plan.push({ op, action: 'CREATE', targetPath: path, existing: null });
        break;
      }

      case BatchOperationType.UPDATE: {
        if (!existing) {
          errors.push(`"${path}" does not exist`);
          continue;
        }
        if (Buffer.byteLength(op.content, 'utf8') > workspaceConfig.MAX_FILE_SIZE_BYTES) {
          errors.push(`"${path}" exceeds the maximum file size`);
          continue;
        }
        if (!claim(path, 'update')) continue;
        plan.push({ op, action: 'MODIFY', targetPath: path, existing });
        break;
      }

      case BatchOperationType.DELETE: {
        if (!existing) {
          errors.push(`"${path}" does not exist`);
          continue;
        }
        if (!claim(path, 'delete')) continue;
        plan.push({ op, action: 'DELETE', targetPath: path, existing });
        break;
      }

      case BatchOperationType.RENAME: {
        if (!existing) {
          errors.push(`"${path}" does not exist`);
          continue;
        }
        const parent = getParentPath(path);
        const destination = parent ? `${parent}/${op.newName}` : op.newName;
        if (existingByPath.has(destination)) {
          conflicts.push(`"${destination}" already exists`);
          continue;
        }
        if (!claim(path, 'rename') || !claim(destination, 'rename target')) continue;
        plan.push({ op, action: 'MODIFY', targetPath: destination, existing });
        break;
      }

      case BatchOperationType.MOVE: {
        if (!existing) {
          errors.push(`"${path}" does not exist`);
          continue;
        }
        let destination: string;
        try {
          destination = assertSafePath(op.destinationPath);
        } catch {
          errors.push(`Invalid destination path: "${op.destinationPath}"`);
          continue;
        }
        if (existingByPath.has(destination)) {
          conflicts.push(`"${destination}" already exists`);
          continue;
        }
        if (existing.type === FileEntryType.FOLDER && destination.startsWith(`${path}/`)) {
          errors.push(`Cannot move "${path}" into its own descendant`);
          continue;
        }
        if (!claim(path, 'move') || !claim(destination, 'move target')) continue;
        for (const ancestor of getAncestorPaths(destination)) {
          if (!existingByPath.has(ancestor)) foldersToCreate.add(ancestor);
        }
        plan.push({ op, action: 'MODIFY', targetPath: destination, existing });
        break;
      }
    }
  }

  const folderPlan: PlannedOperation[] = Array.from(foldersToCreate)
    .sort((a, b) => a.split('/').length - b.split('/').length)
    .map((path) => ({
      op: { type: BatchOperationType.CREATE, path } as BatchOperationInput,
      action: 'CREATE' as const,
      targetPath: path,
      existing: null,
      isFolder: true,
    }));

  return { project, plan: [...folderPlan, ...plan], warnings, errors, conflicts };
}

export async function previewOperations(
  owner: Types.ObjectId,
  projectId: string,
  operations: BatchOperationInput[]
): Promise<IOperationPreviewResult> {
  const { plan, warnings, errors, conflicts } = await planOperations(owner, projectId, operations);

  return {
    valid: errors.length === 0 && conflicts.length === 0,
    operations: plan.map((entry) => ({
      ...entry.op,
      action: entry.action,
      existing: entry.existing?.toJSON() as IOperationPreviewResult['operations'][number]['existing'],
    })),
    warnings,
    errors,
    conflicts,
  };
}
