import { ICoverageSummary, ITestResult, TestResultStatus } from 'shared';

/**
 * Parses only what a real test runner actually produced (spec §34/§59/§85) — never invents a
 * per-test entry. Jest's `--json --outputFile=` and Vitest's `--reporter=json --outputFile=` (from
 * Vitest 1.x onward) both write this same Jest-compatible shape, so one parser covers both of the two
 * frameworks this pass detects.
 */
interface JestLikeAssertionResult {
  title: string;
  ancestorTitles?: string[];
  fullName?: string;
  status: string;
  duration?: number | null;
  failureMessages?: string[];
}

interface JestLikeTestFileResult {
  name: string;
  assertionResults?: JestLikeAssertionResult[];
}

interface JestLikeReport {
  testResults?: JestLikeTestFileResult[];
}

function mapStatus(status: string): TestResultStatus {
  if (status === 'passed') return TestResultStatus.PASSED;
  if (status === 'failed') return TestResultStatus.FAILED;
  return TestResultStatus.SKIPPED;
}

/** The test runner executes inside a container whose only bind mount is `/workspace` (Phase 11) — a
 *  reported absolute file path is always inside that one POSIX filesystem namespace, never the host's,
 *  so stripping the fixed `/workspace/` prefix is correct and simpler (and more robust) than the
 *  previous host-`path.relative` math, which broke once execution moved off the host process. */
function toRelativePath(absoluteOrRelative: string): string {
  const posixPath = absoluteOrRelative.split('\\').join('/');
  if (posixPath === '/workspace') return '';
  if (posixPath.startsWith('/workspace/')) return posixPath.slice('/workspace/'.length);
  return posixPath.replace(/^\/+/, '');
}

/** Best-effort extraction from Jest's free-text failure message — omitted entirely (not guessed) when
 *  the message doesn't match the common "Expected: ... Received: ..." shape. */
function extractExpectedActual(message: string | undefined): { expected?: string; actual?: string } {
  if (!message) return {};
  const expectedMatch = message.match(/Expected:?\s*\n?\s*(.+)/);
  const receivedMatch = message.match(/(?:Received|Actual):?\s*\n?\s*(.+)/);
  return {
    expected: expectedMatch?.[1]?.trim().slice(0, 500),
    actual: receivedMatch?.[1]?.trim().slice(0, 500),
  };
}

export function parseJestLikeReport(raw: string): ITestResult[] {
  let report: JestLikeReport;
  try {
    report = JSON.parse(raw) as JestLikeReport;
  } catch {
    return [];
  }

  if (!Array.isArray(report.testResults)) return [];

  const results: ITestResult[] = [];

  for (const fileResult of report.testResults) {
    const file = toRelativePath(fileResult.name);

    for (const assertion of fileResult.assertionResults ?? []) {
      const failureMessage = assertion.failureMessages?.[0];
      const { expected, actual } = extractExpectedActual(failureMessage);

      results.push({
        suite: assertion.ancestorTitles?.join(' > ') || file,
        test: assertion.title,
        status: mapStatus(assertion.status),
        duration: assertion.duration ?? undefined,
        error: failureMessage?.split('\n')[0]?.slice(0, 500),
        stack: assertion.failureMessages?.join('\n\n').slice(0, 4000) || undefined,
        file,
        expected,
        actual,
      });
    }
  }

  return results;
}

interface IstanbulCoverageMetric {
  pct: number;
}

interface IstanbulCoverageSummary {
  total?: {
    statements?: IstanbulCoverageMetric;
    branches?: IstanbulCoverageMetric;
    functions?: IstanbulCoverageMetric;
    lines?: IstanbulCoverageMetric;
  };
}

/** Only ever returns a value when `coverage/coverage-summary.json` actually exists and parses — the
 *  caller must never display coverage otherwise (spec §26/§36/§65). */
export function parseCoverageSummary(raw: string): ICoverageSummary | undefined {
  let parsed: IstanbulCoverageSummary;
  try {
    parsed = JSON.parse(raw) as IstanbulCoverageSummary;
  } catch {
    return undefined;
  }

  const total = parsed.total;
  if (!total) return undefined;

  return {
    statements: total.statements?.pct ?? 0,
    branches: total.branches?.pct ?? 0,
    functions: total.functions?.pct ?? 0,
    lines: total.lines?.pct ?? 0,
  };
}
