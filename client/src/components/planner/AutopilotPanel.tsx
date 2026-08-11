import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import type { AutopilotTaskOutcome, IAutopilotTaskResult } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AutopilotPhase } from '@/types/autopilot';

const OUTCOME_VARIANT: Record<AutopilotTaskOutcome, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'success',
  skipped: 'secondary',
  failed: 'destructive',
  not_attempted: 'outline',
};

const OUTCOME_ICON: Record<AutopilotTaskOutcome, typeof CheckCircle2> = {
  completed: CheckCircle2,
  skipped: CircleDashed,
  failed: XCircle,
  not_attempted: CircleDashed,
};

function currentLabel(phase: AutopilotPhase | null, stageLabel: string, currentTask: { taskIndex: number; taskCount: number; taskTitle: string } | null) {
  if (phase === 'planning') return stageLabel || 'Generating the plan…';
  if (phase === 'approving') return stageLabel || 'Approving the plan…';
  if (phase === 'task' && currentTask) {
    return `Task ${currentTask.taskIndex}/${currentTask.taskCount}: ${currentTask.taskTitle} — ${stageLabel}`;
  }
  return stageLabel;
}

interface AutopilotPanelProps {
  projectId: string;
  runStatus: 'idle' | 'streaming' | 'error';
  phase: AutopilotPhase | null;
  stageLabel: string;
  currentTask: { taskId: string; taskTitle: string; taskIndex: number; taskCount: number } | null;
  streamError: string | null;
  result: { tasks: IAutopilotTaskResult[]; stoppedEarly: boolean } | null;
}

/** Live progress + finished summary for a "Build It Now" Autopilot run — a small purpose-built
 *  component rather than a reuse of `agent/AgentProgress.tsx`, which is hardcoded to the Frontend
 *  Agent's own 6 fixed stages and is rendered by the untouched manual Frontend Agent panel. */
export function AutopilotPanel({ projectId, runStatus, phase, stageLabel, currentTask, streamError, result }: AutopilotPanelProps) {
  if (runStatus === 'streaming') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        <span>{currentLabel(phase, stageLabel, currentTask)}</span>
      </div>
    );
  }

  if (runStatus === 'error' && streamError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <XCircle className="size-4 shrink-0" />
        <span>{streamError}</span>
      </div>
    );
  }

  if (!result) return null;

  const failedTask = result.tasks.find((task) => task.outcome === 'failed');

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Build summary</h3>
        <Button asChild size="sm">
          <Link href={`/projects/${projectId}/workspace`}>
            Open Workspace <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {result.stoppedEarly && failedTask && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Build stopped at &ldquo;{failedTask.title}&rdquo;: {failedTask.error}. Everything built before that has
            already been applied — you can retry this task from the Frontend Agent panel in the Workspace.
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {result.tasks.map((task) => {
          const Icon = OUTCOME_ICON[task.outcome];
          return (
            <li key={task.taskId} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                {task.title}
              </span>
              <Badge variant={OUTCOME_VARIANT[task.outcome]} className="capitalize">
                {task.outcome.replace('_', ' ')}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
