import { frontendAgentConfig } from '../../config/frontendAgent.config';
import { assertSafePath } from '../../services/files/file-validation.service';
import { FrontendOperationOutput, FrontendOutput, frontendOutputSchema } from './frontend.schema';
import { isForbiddenPath } from './frontend.security';

export type ParseFrontendOutputResult =
  | { success: true; data: FrontendOutput }
  | { success: false; issues: string[] };

/** JSON.parse + Zod validation of the raw text an AI completion returned — mirrors
 *  `planner.validator.ts`'s `parsePlannerOutput` exactly. */
export function parseFrontendOutput(raw: string): ParseFrontendOutputResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, issues: ['The response was not valid JSON.'] };
  }

  const result = frontendOutputSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
    );
    return { success: false, issues };
  }

  return { success: true, data: result.data };
}

function operationSize(op: FrontendOperationOutput): number {
  if (op.type === 'create' || op.type === 'update') {
    return Buffer.byteLength(op.content, 'utf8');
  }
  return 0;
}

/**
 * Every semantic (non-Zod-structural) check the retry loop needs before an operation is allowed
 * anywhere near `preview.service`/`batch.service` (spec §21/§22/§60/§61/§62): duplicate targets,
 * path traversal, forbidden/secret files, `.git`/`node_modules`, empty created files, and the
 * configurable count/size limits.
 */
export function validateOperationSemantics(output: FrontendOutput): string[] {
  const issues: string[] = [];
  const { operations } = output;

  if (operations.length > frontendAgentConfig.MAX_TASK_OPERATIONS) {
    issues.push(
      `A task may propose at most ${frontendAgentConfig.MAX_TASK_OPERATIONS} operations (got ${operations.length})`
    );
  }
  if (operations.length > frontendAgentConfig.MAX_FILES_PER_OPERATION) {
    issues.push(
      `A single generation may touch at most ${frontendAgentConfig.MAX_FILES_PER_OPERATION} files (got ${operations.length})`
    );
  }

  const totalSize = operations.reduce((sum, op) => sum + operationSize(op), 0);
  if (totalSize > frontendAgentConfig.MAX_TOTAL_OPERATION_SIZE) {
    issues.push(
      `Total proposed content size (${totalSize} bytes) exceeds the limit of ${frontendAgentConfig.MAX_TOTAL_OPERATION_SIZE} bytes`
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
      issues.push(`"${op.path}" is a protected file and cannot be modified by the Frontend Agent`);
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
