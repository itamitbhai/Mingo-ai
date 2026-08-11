import { backendAgentConfig } from '../../config/backendAgent.config';
import { assertSafePath } from '../../services/files/file-validation.service';
import { BackendOperationOutput, BackendOutput, backendOutputSchema } from './backend.schema';
import { isForbiddenPath } from './backend.security';

export type ParseBackendOutputResult =
  | { success: true; data: BackendOutput }
  | { success: false; issues: string[] };

/** JSON.parse + Zod validation of the raw text an AI completion returned — mirrors
 *  `frontend.validator.ts`'s `parseFrontendOutput` exactly. */
export function parseBackendOutput(raw: string): ParseBackendOutputResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, issues: ['The response was not valid JSON.'] };
  }

  const result = backendOutputSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
    );
    return { success: false, issues };
  }

  return { success: true, data: result.data };
}

function operationSize(op: BackendOperationOutput): number {
  if (op.type === 'create' || op.type === 'update') {
    return Buffer.byteLength(op.content, 'utf8');
  }
  return 0;
}

/**
 * Every semantic (non-Zod-structural) check the retry loop needs before an operation is allowed
 * anywhere near `preview.service`/`batch.service` (Phase 7 spec §11/§28/§29/§45): duplicate
 * targets, path traversal, forbidden/secret files, `.git`/`node_modules`, empty created files, and
 * the configurable count/size limits — mirrors `frontend.validator.ts`'s
 * `validateOperationSemantics` exactly, against the Backend Agent's own forbidden-path list.
 */
export function validateOperationSemantics(output: BackendOutput): string[] {
  const issues: string[] = [];
  const { operations } = output;

  if (operations.length > backendAgentConfig.MAX_TASK_OPERATIONS) {
    issues.push(
      `A task may propose at most ${backendAgentConfig.MAX_TASK_OPERATIONS} operations (got ${operations.length})`
    );
  }
  if (operations.length > backendAgentConfig.MAX_FILES_PER_OPERATION) {
    issues.push(
      `A single generation may touch at most ${backendAgentConfig.MAX_FILES_PER_OPERATION} files (got ${operations.length})`
    );
  }

  const totalSize = operations.reduce((sum, op) => sum + operationSize(op), 0);
  if (totalSize > backendAgentConfig.MAX_TOTAL_OPERATION_SIZE) {
    issues.push(
      `Total proposed content size (${totalSize} bytes) exceeds the limit of ${backendAgentConfig.MAX_TOTAL_OPERATION_SIZE} bytes`
    );
  }

  const seenPaths = new Set<string>();

  for (const op of operations) {
    if (seenPaths.has(op.path)) {
      issues.push(`Multiple operations target the same path "${op.path}"`);
    }
    seenPaths.add(op.path);

    try {
      assertSafePath(op.path);
    } catch {
      issues.push(`"${op.path}" is not a valid, safe path`);
    }

    if (isForbiddenPath(op.path)) {
      issues.push(`"${op.path}" is a protected file and cannot be modified by the Backend Agent`);
    }

    if (op.type === 'move') {
      try {
        assertSafePath(op.destinationPath);
      } catch {
        issues.push(`"${op.destinationPath}" is not a valid, safe destination path`);
      }
      if (isForbiddenPath(op.destinationPath)) {
        issues.push(`"${op.destinationPath}" is a protected destination and cannot be written to`);
      }
    }

    if (op.type === 'create' && op.content.trim().length === 0) {
      issues.push(`"${op.path}" would be created empty — generate real content or omit it`);
    }
  }

  return issues;
}
