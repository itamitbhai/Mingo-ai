import { databaseAgentConfig } from '../../config/databaseAgent.config';
import { assertSafePath } from '../../services/files/file-validation.service';
import { DatabaseOperationOutput, DatabaseOutput, databaseOutputSchema } from './database.schema';
import { isForbiddenPath } from './database.security';

export type ParseDatabaseOutputResult =
  | { success: true; data: DatabaseOutput }
  | { success: false; issues: string[] };

/** JSON.parse + Zod validation of the raw text an AI completion returned — mirrors
 *  `backend.validator.ts`'s `parseBackendOutput` exactly. */
export function parseDatabaseOutput(raw: string): ParseDatabaseOutputResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, issues: ['The response was not valid JSON.'] };
  }

  const result = databaseOutputSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
    );
    return { success: false, issues };
  }

  return { success: true, data: result.data };
}

function operationSize(op: DatabaseOperationOutput): number {
  if (op.type === 'create' || op.type === 'update') {
    return Buffer.byteLength(op.content, 'utf8');
  }
  return 0;
}

/**
 * Every semantic (non-Zod-structural) check the retry loop needs before an operation is allowed
 * anywhere near `preview.service`/`batch.service` (Phase 8 spec §29/§30/§63/§64): duplicate
 * targets, path traversal, forbidden/secret files, `.git`/`node_modules`, empty created files, the
 * configurable count/size limits — mirrors `backend.validator.ts`'s `validateOperationSemantics`
 * exactly — plus two database-specific structural sanity checks: a duplicate model name across
 * `schemaContracts`, and an index with no fields.
 */
export function validateOperationSemantics(output: DatabaseOutput): string[] {
  const issues: string[] = [];
  const { operations, schemaContracts } = output;

  if (operations.length > databaseAgentConfig.MAX_TASK_OPERATIONS) {
    issues.push(
      `A task may propose at most ${databaseAgentConfig.MAX_TASK_OPERATIONS} operations (got ${operations.length})`
    );
  }
  if (operations.length > databaseAgentConfig.MAX_FILES_PER_OPERATION) {
    issues.push(
      `A single generation may touch at most ${databaseAgentConfig.MAX_FILES_PER_OPERATION} files (got ${operations.length})`
    );
  }

  const totalSize = operations.reduce((sum, op) => sum + operationSize(op), 0);
  if (totalSize > databaseAgentConfig.MAX_TOTAL_OPERATION_SIZE) {
    issues.push(
      `Total proposed content size (${totalSize} bytes) exceeds the limit of ${databaseAgentConfig.MAX_TOTAL_OPERATION_SIZE} bytes`
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
      issues.push(`"${op.path}" is a protected file and cannot be modified by the Database Agent`);
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

  const seenModels = new Set<string>();
  for (const schema of schemaContracts) {
    if (seenModels.has(schema.model)) {
      issues.push(`Multiple schemaContracts entries describe the same model "${schema.model}"`);
    }
    seenModels.add(schema.model);

    for (const index of schema.indexes) {
      if (Object.keys(index.fields).length === 0) {
        issues.push(`An index on model "${schema.model}" has no fields`);
      }
    }
  }

  return issues;
}
