import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/backendAgent.config', () => ({
  backendAgentConfig: {
    MAX_FILES_PER_OPERATION: 50,
    MAX_TASK_OPERATIONS: 100,
    MAX_TOTAL_OPERATION_SIZE: 20 * 1024 * 1024,
  },
}));

import { parseBackendOutput, validateOperationSemantics } from './backend.validator';
import { BackendOutput } from './backend.schema';

function validOutput(overrides: Partial<BackendOutput> = {}): BackendOutput {
  return {
    operations: [
      {
        type: 'create',
        path: 'server/routes/todo.routes.js',
        content: "const router = require('express').Router(); module.exports = router;",
        reason: 'New Todo routes',
      },
    ],
    dependencyRequests: [],
    apiContracts: [],
    ...overrides,
  };
}

describe('parseBackendOutput', () => {
  it('reports invalid JSON as an issue rather than throwing', () => {
    const result = parseBackendOutput('not valid json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContain('The response was not valid JSON.');
    }
  });

  it('rejects an empty operations array', () => {
    const result = parseBackendOutput(JSON.stringify({ operations: [] }));
    expect(result.success).toBe(false);
  });

  it('parses a valid output', () => {
    const result = parseBackendOutput(JSON.stringify(validOutput()));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.operations).toHaveLength(1);
    }
  });

  it('parses apiContracts entries', () => {
    const result = parseBackendOutput(
      JSON.stringify(
        validOutput({
          apiContracts: [{ method: 'POST', path: '/api/todos', authentication: true }],
        })
      )
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiContracts).toEqual([{ method: 'POST', path: '/api/todos', authentication: true }]);
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
        { type: 'create', path: 'server/app.js', content: 'x', reason: 'r' },
        { type: 'update', path: 'server/app.js', content: 'y', reason: 'r' },
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
      operations: [{ type: 'update', path: '.env', content: 'SECRET=1', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('protected file'))).toBe(true);
  });

  it('flags an empty created file', () => {
    const output = validOutput({
      operations: [{ type: 'create', path: 'server/routes/empty.routes.js', content: '   ', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('would be created empty'))).toBe(true);
  });

  it('flags exceeding the max operations-per-task limit', () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      type: 'create' as const,
      path: `server/routes/File${i}.routes.js`,
      content: 'x',
      reason: 'r',
    }));

    const issues = validateOperationSemantics(validOutput({ operations }));
    expect(issues.some((issue) => issue.includes('at most 100 operations'))).toBe(true);
  });
});
