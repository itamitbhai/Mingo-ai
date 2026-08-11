import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/databaseAgent.config', () => ({
  databaseAgentConfig: {
    MAX_FILES_PER_OPERATION: 50,
    MAX_TASK_OPERATIONS: 100,
    MAX_TOTAL_OPERATION_SIZE: 20 * 1024 * 1024,
  },
}));

import { parseDatabaseOutput, validateOperationSemantics } from './database.validator';
import { DatabaseOutput } from './database.schema';

function validOutput(overrides: Partial<DatabaseOutput> = {}): DatabaseOutput {
  return {
    operations: [
      {
        type: 'create',
        path: 'server/models/Todo.js',
        content: "const mongoose = require('mongoose'); module.exports = mongoose.model('Todo', new mongoose.Schema({}));",
        reason: 'New Todo model',
      },
    ],
    dependencyRequests: [],
    schemaContracts: [],
    databaseChanges: [],
    ...overrides,
  };
}

describe('parseDatabaseOutput', () => {
  it('reports invalid JSON as an issue rather than throwing', () => {
    const result = parseDatabaseOutput('not valid json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContain('The response was not valid JSON.');
    }
  });

  it('rejects an empty operations array', () => {
    const result = parseDatabaseOutput(JSON.stringify({ operations: [] }));
    expect(result.success).toBe(false);
  });

  it('parses a valid output with a schema contract', () => {
    const result = parseDatabaseOutput(
      JSON.stringify(
        validOutput({
          schemaContracts: [
            {
              model: 'Todo',
              collection: 'todos',
              fields: { title: { type: 'String', required: true } },
              indexes: [{ fields: { userId: 1, createdAt: -1 }, reason: 'listing' }],
            },
          ],
        })
      )
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaContracts).toHaveLength(1);
      expect(result.data.schemaContracts[0].model).toBe('Todo');
    }
  });
});

describe('validateOperationSemantics', () => {
  it('passes for a single well-formed create operation', () => {
    expect(validateOperationSemantics(validOutput())).toEqual([]);
  });

  it('flags duplicate operation targets', () => {
    const output = validOutput({
      operations: [
        { type: 'create', path: 'server/models/Todo.js', content: 'x', reason: 'r' },
        { type: 'update', path: 'server/models/Todo.js', content: 'y', reason: 'r' },
      ],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('Multiple operations target'))).toBe(true);
  });

  it('flags a path traversal attempt', () => {
    const output = validOutput({
      operations: [{ type: 'create', path: '../../etc/evil.js' as never, content: 'x', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags a forbidden/secret file target', () => {
    const output = validOutput({
      operations: [{ type: 'update', path: '.env', content: 'MONGO_URI=1', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('protected file'))).toBe(true);
  });

  it('flags an empty created file', () => {
    const output = validOutput({
      operations: [{ type: 'create', path: 'server/models/Empty.js', content: '   ', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('would be created empty'))).toBe(true);
  });

  it('flags exceeding the max operations-per-task limit', () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      type: 'create' as const,
      path: `server/models/Model${i}.js`,
      content: 'x',
      reason: 'r',
    }));

    const issues = validateOperationSemantics(validOutput({ operations }));
    expect(issues.some((issue) => issue.includes('at most 100 operations'))).toBe(true);
  });

  it('flags duplicate model names across schemaContracts', () => {
    const output = validOutput({
      schemaContracts: [
        { model: 'Todo', collection: 'todos', fields: {}, indexes: [] },
        { model: 'Todo', collection: 'todos_v2', fields: {}, indexes: [] },
      ],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('same model "Todo"'))).toBe(true);
  });

  it('flags an index with no fields', () => {
    const output = validOutput({
      schemaContracts: [
        { model: 'Todo', collection: 'todos', fields: {}, indexes: [{ fields: {}, reason: 'oops' }] },
      ],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('has no fields'))).toBe(true);
  });
});
