'use client';

import { Loader2, Sparkles, RotateCcw, Wrench } from 'lucide-react';
import type { ITestFailureAnalysis, ITestResult } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FailedTestCardProps {
  result: ITestResult;
  analysis?: ITestFailureAnalysis;
  isExplaining: boolean;
  isFixing: boolean;
  onExplain: () => void;
  onGenerateFix: () => void;
  onRunAgain: () => void;
}

const CONFIDENCE_VARIANT: Record<ITestFailureAnalysis['confidence'], 'success' | 'warning' | 'destructive'> = {
  high: 'success',
  medium: 'warning',
  low: 'destructive',
};

/**
 * One failing test's detail (spec §37/§66) — name, file/line, error, expected/actual, stack, plus
 * `Explain Failure` / `Generate Fix` / `Run Again` actions (spec §68). `Generate Fix` produces a new
 * `AgentGeneration` that reopens the exact same `ChangePreview`/apply flow every other agent uses —
 * this component never renders its own diff UI.
 */
export function FailedTestCard({
  result,
  analysis,
  isExplaining,
  isFixing,
  onExplain,
  onGenerateFix,
  onRunAgain,
}: FailedTestCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-destructive">{result.suite}</p>
          <p className="text-foreground">{result.test}</p>
        </div>
        {result.file && (
          <span className="shrink-0 font-mono text-muted-foreground">
            {result.file}
            {result.line ? `:${result.line}` : ''}
          </span>
        )}
      </div>

      {result.error && <p className="whitespace-pre-wrap text-destructive">{result.error}</p>}

      {(result.expected || result.actual) && (
        <div className="grid grid-cols-2 gap-2">
          {result.expected && (
            <div className="rounded border border-border/40 p-1.5">
              <p className="mb-0.5 text-muted-foreground">Expected</p>
              <p className="font-mono">{result.expected}</p>
            </div>
          )}
          {result.actual && (
            <div className="rounded border border-border/40 p-1.5">
              <p className="mb-0.5 text-muted-foreground">Actual</p>
              <p className="font-mono">{result.actual}</p>
            </div>
          )}
        </div>
      )}

      {result.stack && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">Stack trace</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {result.stack}
          </pre>
        </details>
      )}

      {analysis && (
        <div className="flex flex-col gap-1 rounded border border-border/40 bg-card/60 p-2">
          <div className="flex items-center justify-between">
            <p className="font-medium">Root cause</p>
            <Badge variant={CONFIDENCE_VARIANT[analysis.confidence]} className="capitalize">
              {analysis.confidence} confidence
            </Badge>
          </div>
          <p>{analysis.rootCause}</p>
          {analysis.affectedFile && <p className="font-mono text-muted-foreground">{analysis.affectedFile}</p>}
          <p className="text-muted-foreground">{analysis.why}</p>
          <p>
            <span className="font-medium">Recommended fix: </span>
            {analysis.recommendedFix}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onExplain} disabled={isExplaining}>
          {isExplaining ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Explain Failure
        </Button>
        <Button size="sm" variant="outline" onClick={onGenerateFix} disabled={isFixing}>
          {isFixing ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
          Generate Fix
        </Button>
        <Button size="sm" variant="ghost" onClick={onRunAgain}>
          <RotateCcw className="size-3.5" /> Run Again
        </Button>
      </div>
    </div>
  );
}
