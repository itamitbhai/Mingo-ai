import { describe, expect, it } from 'vitest';
import { parseTestingOutput, validateOperationSemantics } from './testing.validator';
import { TestingOutput } from './testing.schema';

function validOutput(overrides: Partial<TestingOutput> = {}): TestingOutput {
  return {
    operations: [
      {
        type: 'create',
        path: 'server/tests/todo.test.js',
        content: "const { describe, it, expect } = require('vitest'); describe('todo', () => { it('works', () => expect(1).toBe(1)); });",
        reason: 'Unit test for Todo service',
      },
    ],
    dependencyRequests: [],
    testPlan: [],
    contractWarnings: [],
    ...overrides,
  };
}

describe('parseTestingOutput', () => {
  it('reports invalid JSON as an issue rather than throwing', () => {
    const result = parseTestingOutput('not valid json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContain('The response was not valid JSON.');
    }
  });

  it('rejects an empty operations array', () => {
    const result = parseTestingOutput(JSON.stringify({ operations: [] }));
    expect(result.success).toBe(false);
  });

  it('parses a valid output with a test plan', () => {
    const result = parseTestingOutput(
      JSON.stringify(
        validOutput({
          testPlan: [{ name: 'Todo Service', type: 'unit', priority: 'high', tests: ['creates a todo'] }],
        })
      )
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.testPlan).toHaveLength(1);
      expect(result.data.testPlan[0].name).toBe('Todo Service');
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
        { type: 'create', path: 'server/tests/todo.test.js', content: 'x', reason: 'r' },
        { type: 'update', path: 'server/tests/todo.test.js', content: 'y', reason: 'r' },
      ],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('Multiple operations target'))).toBe(true);
  });

  it('flags a path traversal attempt', () => {
    const output = validOutput({
      operations: [{ type: 'create', path: '../../etc/evil.js' as never, content: 'x', reason: 'r' }],
    });

    expect(validateOperationSemantics(output).length).toBeGreaterThan(0);
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
      operations: [{ type: 'create', path: 'server/tests/empty.test.js', content: '   ', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('would be created empty'))).toBe(true);
  });

  it('flags exceeding the max operations-per-task limit', () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      type: 'create' as const,
      path: `server/tests/test${i}.test.js`,
      content: 'x',
      reason: 'r',
    }));

    const issues = validateOperationSemantics(validOutput({ operations }));
    expect(issues.some((issue) => issue.includes('at most 100 operations'))).toBe(true);
  });

  it('flags a real-looking secret inside a created test file', () => {
    const output = validOutput({
      operations: [
        {
          type: 'create',
          path: 'server/tests/todo.test.js',
          content: 'const key = "AKIAABCDEFGHIJKLMNOP";',
          reason: 'r',
        },
      ],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('AWS access key'))).toBe(true);
  });

  it('does not flag an ordinary process.env reference', () => {
    const output = validOutput({
      operations: [
        {
          type: 'create',
          path: 'server/tests/todo.test.js',
          content: 'const uri = process.env.MONGODB_URI;',
          reason: 'r',
        },
      ],
    });

    expect(validateOperationSemantics(output)).toEqual([]);
  });
});
