import { describe, expect, it } from 'vitest';
import { parseCoverageSummary, parseJestLikeReport } from './result-parser.service';

function jestLikeReport(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    testResults: [
      {
        name: '/workspace/server/tests/todo.test.js',
        assertionResults: [
          { title: 'creates a todo', ancestorTitles: ['Todo API'], status: 'passed', duration: 12 },
          {
            title: 'rejects an unauthenticated request',
            ancestorTitles: ['Todo API'],
            status: 'failed',
            duration: 8,
            failureMessages: ['Error: Expected: 401\nReceived: 500\n    at Object.<anonymous>'],
          },
          { title: 'is skipped for now', ancestorTitles: ['Todo API'], status: 'pending', duration: null },
        ],
      },
    ],
    ...overrides,
  });
}

describe('parseJestLikeReport', () => {
  it('returns an empty array for invalid JSON — never throws, never fabricates', () => {
    expect(parseJestLikeReport('not json')).toEqual([]);
  });

  it('returns an empty array when the shape has no testResults', () => {
    expect(parseJestLikeReport(JSON.stringify({ foo: 'bar' }))).toEqual([]);
  });

  it('maps passed/failed/pending statuses and strips the fixed /workspace container prefix', () => {
    const results = parseJestLikeReport(jestLikeReport());

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      suite: 'Todo API',
      test: 'creates a todo',
      status: 'passed',
      duration: 12,
      file: 'server/tests/todo.test.js',
    });
    expect(results[1].status).toBe('failed');
    expect(results[2].status).toBe('skipped');
  });

  it('extracts a first-line error and best-effort expected/actual from a failure message', () => {
    const results = parseJestLikeReport(jestLikeReport());
    const failure = results[1];

    expect(failure.error).toContain('Expected: 401');
    expect(failure.stack).toContain('at Object.<anonymous>');
  });

  it('falls back to the file path as the suite name when ancestorTitles is empty', () => {
    const report = JSON.stringify({
      testResults: [
        {
          name: '/workspace/server/tests/util.test.js',
          assertionResults: [{ title: 'formats a date', ancestorTitles: [], status: 'passed' }],
        },
      ],
    });

    const results = parseJestLikeReport(report);
    expect(results[0].suite).toBe('server/tests/util.test.js');
  });

  it('leaves an already-relative path untouched', () => {
    const report = JSON.stringify({
      testResults: [
        {
          name: 'server/tests/util.test.js',
          assertionResults: [{ title: 'formats a date', ancestorTitles: [], status: 'passed' }],
        },
      ],
    });

    const results = parseJestLikeReport(report);
    expect(results[0].file).toBe('server/tests/util.test.js');
  });
});

describe('parseCoverageSummary', () => {
  it('returns undefined for invalid JSON', () => {
    expect(parseCoverageSummary('not json')).toBeUndefined();
  });

  it('returns undefined when there is no "total" key', () => {
    expect(parseCoverageSummary(JSON.stringify({ 'src/foo.js': {} }))).toBeUndefined();
  });

  it('extracts the four percentage metrics from a real Istanbul summary', () => {
    const raw = JSON.stringify({
      total: {
        statements: { pct: 84.2 },
        branches: { pct: 71.5 },
        functions: { pct: 88 },
        lines: { pct: 83.9 },
      },
    });

    expect(parseCoverageSummary(raw)).toEqual({ statements: 84.2, branches: 71.5, functions: 88, lines: 83.9 });
  });
});
