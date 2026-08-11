import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/frontendAgent.config', () => ({
  frontendAgentConfig: {
    MAX_FILES_PER_OPERATION: 50,
    MAX_TASK_OPERATIONS: 100,
    MAX_TOTAL_OPERATION_SIZE: 20 * 1024 * 1024,
  },
}));

import { parseFrontendOutput, validateOperationSemantics } from './frontend.validator';
import { FrontendOutput } from './frontend.schema';

function validOutput(overrides: Partial<FrontendOutput> = {}): FrontendOutput {
  return {
    operations: [
      { type: 'create', path: 'src/components/ProductCard.tsx', content: 'export default function ProductCard() { return null; }', reason: 'New card' },
    ],
    dependencyRequests: [],
    ...overrides,
  };
}

describe('parseFrontendOutput', () => {
  it('reports invalid JSON as an issue rather than throwing', () => {
    const result = parseFrontendOutput('not valid json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContain('The response was not valid JSON.');
    }
  });

  it('rejects an empty operations array', () => {
    const result = parseFrontendOutput(JSON.stringify({ operations: [] }));
    expect(result.success).toBe(false);
  });

  it('parses a valid output', () => {
    const result = parseFrontendOutput(JSON.stringify(validOutput()));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.operations).toHaveLength(1);
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
        { type: 'create', path: 'src/App.tsx', content: 'x', reason: 'r' },
        { type: 'update', path: 'src/App.tsx', content: 'y', reason: 'r' },
      ],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('Multiple operations target'))).toBe(true);
  });

  it('flags a path traversal attempt', () => {
    // relativePathSchema normalizes/rejects this before it even reaches assertSafePath, but the
    // validator's own assertSafePath call is the last line of defense — verify it still catches it.
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
      operations: [{ type: 'create', path: 'src/Empty.tsx', content: '   ', reason: 'r' }],
    });

    const issues = validateOperationSemantics(output);
    expect(issues.some((issue) => issue.includes('would be created empty'))).toBe(true);
  });

  it('flags exceeding the max operations-per-task limit', () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      type: 'create' as const,
      path: `src/File${i}.tsx`,
      content: 'x',
      reason: 'r',
    }));

    const issues = validateOperationSemantics(validOutput({ operations }));
    expect(issues.some((issue) => issue.includes('at most 100 operations'))).toBe(true);
  });
});
