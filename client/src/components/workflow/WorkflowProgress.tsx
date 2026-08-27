import { WorkflowTaskStatus, type IWorkflow } from 'shared';

interface WorkflowProgressProps {
  workflow: IWorkflow;
}

const DONE_STATUSES: string[] = [WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.SKIPPED];

/** Real `completed/total` progress computed from the workflow's actual task states (spec §51) — never
 *  a fabricated or estimated percentage. */
export function WorkflowProgress({ workflow }: WorkflowProgressProps) {
  const total = workflow.tasks.length;
  const completed = workflow.tasks.filter((task) => DONE_STATUSES.includes(task.status)).length;
  const failed = workflow.tasks.filter((task) => task.status === WorkflowTaskStatus.FAILED).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completed} of {total} tasks{failed > 0 ? ` · ${failed} failed` : ''}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${failed > 0 ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
