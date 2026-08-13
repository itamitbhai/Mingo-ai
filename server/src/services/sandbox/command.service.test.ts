import { describe, expect, it } from 'vitest';
import { buildReporterArgs, detectTestCommandFromPackageJson } from './command.service';

describe('detectTestCommandFromPackageJson', () => {
  it('returns null for invalid JSON', () => {
    expect(detectTestCommandFromPackageJson('package.json', 'not json')).toBeNull();
  });

  it('returns null when no known test script exists', () => {
    const raw = JSON.stringify({ scripts: { start: 'node index.js', build: 'tsc' } });
    expect(detectTestCommandFromPackageJson('package.json', raw)).toBeNull();
  });

  it('detects the root "test" script and vitest as the framework', () => {
    const raw = JSON.stringify({
      scripts: { test: 'vitest run' },
      devDependencies: { vitest: '^1.0.0' },
    });

    const result = detectTestCommandFromPackageJson('package.json', raw);
    expect(result).toEqual({ cwd: '', packageJsonPath: 'package.json', script: 'test', framework: 'vitest' });
  });

  it('derives the cwd from a nested package.json path and detects jest', () => {
    const raw = JSON.stringify({
      scripts: { test: 'jest' },
      devDependencies: { jest: '^29.0.0' },
    });

    const result = detectTestCommandFromPackageJson('server/package.json', raw);
    expect(result).toEqual({ cwd: 'server', packageJsonPath: 'server/package.json', script: 'test', framework: 'jest' });
  });

  it('prioritizes "test" over "test:unit" when both exist', () => {
    const raw = JSON.stringify({ scripts: { test: 'vitest run', 'test:unit': 'vitest run unit' } });
    const result = detectTestCommandFromPackageJson('package.json', raw);
    expect(result?.script).toBe('test');
  });

  it('falls back to "test:unit" when "test" is not declared', () => {
    const raw = JSON.stringify({ scripts: { 'test:unit': 'vitest run unit' } });
    const result = detectTestCommandFromPackageJson('package.json', raw);
    expect(result?.script).toBe('test:unit');
  });

  it('reports an unrecognized test runner as "unknown" rather than guessing', () => {
    const raw = JSON.stringify({ scripts: { test: 'ava' }, devDependencies: { ava: '^5.0.0' } });
    const result = detectTestCommandFromPackageJson('package.json', raw);
    expect(result?.framework).toBe('unknown');
  });
});

describe('buildReporterArgs', () => {
  it('builds Jest JSON reporter args', () => {
    expect(buildReporterArgs('jest', '/tmp/report.json')).toEqual(['--json', '--outputFile=/tmp/report.json']);
  });

  it('builds Vitest JSON reporter args', () => {
    expect(buildReporterArgs('vitest', '/tmp/report.json')).toEqual(['--reporter=json', '--outputFile=/tmp/report.json']);
  });

  it('returns no extra args for an unknown framework — never guesses a CLI flag', () => {
    expect(buildReporterArgs('unknown', '/tmp/report.json')).toEqual([]);
  });

  it('returns no extra args for mocha (not yet supported for structured parsing)', () => {
    expect(buildReporterArgs('mocha', '/tmp/report.json')).toEqual([]);
  });
});
