'use client';

import { CheckCircle2, CircleSlash, Loader2, Play, XCircle } from 'lucide-react';
import { TestResultStatus, TestRunStatus, type ITestFailureAnalysis, type ITestResult, type ITestRun } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TestRunStage } from '@/types/test-run';
import { FailedTestCard } from './FailedTestCard';
import { TestRunProgress } from './TestRunProgress';

const STATUS_VARIANT: Record<TestRunStatus, 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  [TestRunStatus.QUEUED]: 'outline',
  [TestRunStatus.PREPARING]: 'outline',
  [TestRunStatus.INSTALLING]: 'warning',
  [TestRunStatus.RUNNING]: 'warning',
  [TestRunStatus.PASSED]: 'success',
  [TestRunStatus.FAILED]: 'destructive',
  [TestRunStatus.ERROR]: 'destructive',
  [TestRunStatus.CANCELLED]: 'secondary',
  [TestRunStatus.TIMEOUT]: 'destructive',
};

interface TestResultsPanelProps {
  testRun: ITestRun | null;
  isStreaming: boolean;
  stage: TestRunStage | null;
  stageLabel: string;
  streamError: string | null;
  analyses: Record<number, ITestFailureAnalysis>;
  explainingIndex: number | null;
  fixingIndex: number | null;
  onRunAll: () => void;
  onRunFailed: () => void;
  onCancel: () => void;
  onExplain: (resultIndex: number) => void;
  onGenerateFix: (resultIndex: number) => void;
  onRunFile: (result: ITestResult) => void;
}

/**
 * Test dashboard (spec §36/§58/§66): real pass/failed/skipped counts, coverage only when actually
 * measured, terminal-style logs, and per-failure detail through `FailedTestCard`. Nothing here is
 * simulated — every number traces back to the `ITestRun` the sandbox execution engine produced.
 */
export function TestResultsPanel({
  testRun,
  isStreaming,
  stage,
  stageLabel,
  streamError,
  analyses,
  explainingIndex,
  fixingIndex,
  onRunAll,
  onRunFailed,
  onCancel,
  onExplain,
  onGenerateFix,
  onRunFile,
}: TestResultsPanelProps) {
  const failedResults = testRun?.results.filter((result) => result.status === TestResultStatus.FAILED) ?? [];
  const otherResults = testRun?.results.filter((result) => result.status !== TestResultStatus.FAILED) ?? [];
  const hasFailedRun =
    testRun && (testRun.status === TestRunStatus.FAILED || testRun.status === TestRunStatus.TIMEOUT) && failedResults.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Test Results</h3>
        <div className="flex items-center gap-1.5">
          {testRun && <Badge variant={STATUS_VARIANT[testRun.status]} className="capitalize">{testRun.status}</Badge>}
          {isStreaming ? (
            <Button size="sm" variant="outline" onClick={onCancel}>
              <XCircle className="size-3.5" /> Cancel
            </Button>
          ) : (
            <>
              {hasFailedRun && (
                <Button size="sm" variant="outline" onClick={onRunFailed}>
                  <Play className="size-3.5" /> Run Failed
                </Button>
              )}
              <Button size="sm" onClick={onRunAll}>
                <Play className="size-3.5" /> Run Tests
              </Button>
            </>
          )}
        </div>
      </div>

      {isStreaming && <TestRunProgress stage={stage} stageLabel={stageLabel} />}
      {!isStreaming && streamError && <TestRunProgress stage="error" stageLabel="" error={streamError} />}

      {testRun?.command && <p className="font-mono text-xs text-muted-foreground">{testRun.command}</p>}

      {testRun?.summary && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="size-4" /> {testRun.summary.passed} passed
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="size-4" /> {testRun.summary.failed} failed
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <CircleSlash className="size-4" /> {testRun.summary.skipped} skipped
          </span>
        </div>
      )}

      {testRun?.coverage && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          {(['statements', 'branches', 'functions', 'lines'] as const).map((metric) => (
            <div key={metric} className="rounded border border-border/40 p-2 text-center">
              <p className="text-muted-foreground capitalize">{metric}</p>
              <p className="text-sm font-semibold">{testRun.coverage![metric]}%</p>
            </div>
          ))}
        </div>
      )}

      {failedResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {failedResults.map((result) => {
            const index = testRun!.results.indexOf(result);
            return (
              <FailedTestCard
                key={`${result.suite}-${result.test}-${index}`}
                result={result}
                analysis={analyses[index]}
                isExplaining={explainingIndex === index}
                isFixing={fixingIndex === index}
                onExplain={() => onExplain(index)}
                onGenerateFix={() => onGenerateFix(index)}
                onRunAgain={() => onRunFile(result)}
              />
            );
          })}
        </div>
      )}

      {otherResults.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {otherResults.length} other result{otherResults.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {otherResults.map((result, index) => (
              <li key={`${result.suite}-${result.test}-${index}`} className="flex items-center gap-1.5">
                {result.status === TestResultStatus.PASSED ? (
                  <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
                ) : (
                  <CircleSlash className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span>
                  {result.suite} · {result.test}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {testRun?.error && <p className="text-xs text-destructive">{testRun.error}</p>}

      {(testRun?.logs.stdout || testRun?.logs.stderr) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Logs{testRun.logs.truncated ? ' (truncated)' : ''}
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/80 p-2 font-mono text-[11px] text-emerald-400">
            {testRun.logs.stdout}
            {testRun.logs.stderr}
          </pre>
        </details>
      )}

      {isStreaming && !testRun?.results.length && (
        <p className="text-xs text-muted-foreground">
          <Loader2 className="mr-1 inline size-3 animate-spin" /> Waiting for results…
        </p>
      )}
    </div>
  );
}
