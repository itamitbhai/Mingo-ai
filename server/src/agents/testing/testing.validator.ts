import { testingAgentConfig } from '../../config/testingAgent.config';
import { assertSafePath } from '../../services/files/file-validation.service';
import { TestingOperationOutput, TestingOutput, testingOutputSchema } from './testing.schema';
import { isForbiddenPath, scanForSecrets } from './testing.security';

export type ParseTestingOutputResult =
  | { success: true; data: TestingOutput }
  | { success: false; issues: string[] };

/** JSON.parse + Zod validation of the raw text an AI completion returned — mirrors
 *  `database.validator.ts`'s `parseDatabaseOutput` exactly. */
export function parseTestingOutput(raw: string): ParseTestingOutputResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, issues: ['The response was not valid JSON.'] };
  }

  const result = testingOutputSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return { success: false, issues };
  }

  return { success: true, data: result.data };
}

function operationSize(op: TestingOperationOutput): number {
  if (op.type === 'create' || op.type === 'update') {
    return Buffer.byteLength(op.content, 'utf8');
  }
  return 0;
}

/**
 * Every semantic (non-Zod-structural) check the retry loop needs before an operation is allowed
 * anywhere near `preview.service`/`batch.service` (spec §22/§48) — duplicate targets, path traversal,
 * forbidden/secret files, empty created files, the configurable count/size limits, mirroring
 * `database.validator.ts`'s `validateOperationSemantics` — plus the Testing-Agent-specific secret scan
 * (spec §47) over every `create`/`update` operation's content.
 */
export function validateOperationSemantics(output: TestingOutput): string[] {
  const issues: string[] = [];
  const { operations } = output;

  if (operations.length > testingAgentConfig.MAX_TASK_OPERATIONS) {
    issues.push(
      `A task may propose at most ${testingAgentConfig.MAX_TASK_OPERATIONS} operations (got ${operations.length})`
    );
  }
  if (operations.length > testingAgentConfig.MAX_FILES_PER_OPERATION) {
    issues.push(
      `A single generation may touch at most ${testingAgentConfig.MAX_FILES_PER_OPERATION} files (got ${operations.length})`
    );
  }

  const totalSize = operations.reduce((sum, op) => sum + operationSize(op), 0);
  if (totalSize > testingAgentConfig.MAX_TOTAL_OPERATION_SIZE) {
    issues.push(
      `Total proposed content size (${totalSize} bytes) exceeds the limit of ${testingAgentConfig.MAX_TOTAL_OPERATION_SIZE} bytes`
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
      issues.push(`"${op.path}" is a protected file and cannot be modified by the Testing Agent`);
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
      issues.push(`"${op.path}" would be created empty — generate real test content or omit it`);
    }

    if (op.type === 'create' || op.type === 'update') {
      for (const secretIssue of scanForSecrets(op.content)) {
        issues.push(`"${op.path}": ${secretIssue}`);
      }
    }
  }

  return issues;
}
