'use client';

import { CheckCircle2, CircleDashed, Eye, Loader2, UserCog, XCircle } from 'lucide-react';
import { WorkflowTaskStatus, type IPlanTask, type IWorkflowTaskState } from 'shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<
  WorkflowTaskStatus,
  'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning'
> = {
  [WorkflowTaskStatus.PENDING]: 'outline',
  [WorkflowTaskStatus.BLOCKED]: 'secondary',
  [WorkflowTaskStatus.READY]: 'default',
  [WorkflowTaskStatus.QUEUED]: 'default',
  [WorkflowTaskStatus.RUNNING]: 'warning',
  [WorkflowTaskStatus.WAITING]: 'warning',
  [WorkflowTaskStatus.COMPLETED]: 'success',
  [WorkflowTaskStatus.FAILED]: 'destructive',
  [WorkflowTaskStatus.CANCELLED]: 'secondary',
  [WorkflowTaskStatus.RETRYING]: 'warning',
  [WorkflowTaskStatus.SKIPPED]: 'secondary',
  [WorkflowTaskStatus.NEEDS_REVIEW]: 'warning',
};

function StatusIcon({ status }: { status: WorkflowTaskStatus }) {
  if (status === WorkflowTaskStatus.COMPLETED) return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />;
  if (status === WorkflowTaskStatus.FAILED) return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (status === WorkflowTaskStatus.NEEDS_REVIEW) return <Eye className="size-4 shrink-0 text-amber-500" />;
  if (
    status === WorkflowTaskStatus.RUNNING ||
    status === WorkflowTaskStatus.RETRYING ||
    status === WorkflowTaskStatus.QUEUED
  ) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  }
  return <CircleDashed className="size-4 shrink-0 text-muted-foreground" />;
}

interface TaskGraphProps {
  tasks: IPlanTask[];
  taskStates: IWorkflowTaskState[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

/**
 * The workflow's task DAG as a connector-styled list (spec §3/§4/§49) — dependencies rendered as a
 * "depends on" line under each task rather than a node/edge diagram, matching this codebase's
 * established no-graph-library convention (`DatabaseSchemaPreview.tsx`/`docs/ARCHITECTURE.md`: React
 * Flow isn't installed). Real data only — every task/status/dependency shown comes from the actual
 * plan and workflow state, nothing hardcoded.
 */
export function TaskGraph({ tasks, taskStates, selectedTaskId, onSelectTask }: TaskGraphProps) {
  const stateByTaskId = new Map(taskStates.map((state) => [state.taskId, state]));

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">This plan has no tasks.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => {
        const state = stateByTaskId.get(task.id);
        const status = state?.status ?? WorkflowTaskStatus.PENDING;

        return (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelectTask(task.id)}
            className={cn(
              'flex flex-col gap-1 rounded-md border p-2 text-left text-xs transition-colors hover:bg-card/60',
              selectedTaskId === task.id ? 'border-primary/60 bg-card/60' : 'border-border/60 bg-card/30'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <StatusIcon status={status} />
                <span className="truncate font-medium text-foreground">{task.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary" className="gap-1 capitalize">
                  <UserCog className="size-3" /> {state?.agentId ?? 'unassigned'}
                </Badge>
                <Badge variant={STATUS_VARIANT[status]} className="capitalize">
                  {status.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {task.dependencies.length > 0 && (
              <p className="pl-6 text-muted-foreground">
                depends on <span className="font-mono">{task.dependencies.join(', ')}</span>
              </p>
            )}

            {state?.error && <p className="pl-6 text-destructive">{state.error}</p>}
          </button>
        );
      })}
    </div>
  );
}
