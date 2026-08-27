'use client';

import { Loader2, RotateCcw, XCircle } from 'lucide-react';
import type { IPlanTask, IWorkflowTaskState } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FailurePanelProps {
  task: IPlanTask;
  taskState: IWorkflowTaskState;
  isRetrying: boolean;
  onRetry: () => void;
}

/** A failed (non-test) task's detail (spec §62) — the real, classified failure category and error
 *  message this task actually produced, plus Retry. Unlike a test failure (`FailedTestCard.tsx`,
 *  Phase 9), there's no AI-generated root-cause analysis here: that mechanism is specific to a parsed
 *  `ITestResult`, and inventing an explanation for an arbitrary agent failure without that same
 *  evidence would risk exactly the false-confidence the Testing Agent's own analyzer is built to
 *  avoid — so this only ever shows what's actually known. */
export function FailurePanel({ task, taskState, isRetrying, onRetry }: FailurePanelProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
      <div className="flex items-center gap-2">
        <XCircle className="size-4 shrink-0 text-destructive" />
        <p className="font-semibold text-destructive">{task.title} failed</p>
      </div>

      {taskState.failureCategory && (
        <Badge variant="destructive" className="w-fit capitalize">
          {taskState.failureCategory.replace(/_/g, ' ').toLowerCase()}
        </Badge>
      )}

      {taskState.error && <p className="whitespace-pre-wrap text-foreground">{taskState.error}</p>}

      <p className="text-muted-foreground">
        Attempt {taskState.attempts} · agent: {taskState.agentId}
      </p>

      <div className="pt-1">
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Retry Task
        </Button>
      </div>
    </div>
  );
}
