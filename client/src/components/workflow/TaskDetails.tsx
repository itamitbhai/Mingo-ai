import { WorkflowTaskStatus, type IPlanTask, type IWorkflowTaskState } from 'shared';
import { Badge } from '@/components/ui/badge';

interface TaskDetailsProps {
  task: IPlanTask;
  taskState?: IWorkflowTaskState;
}

/** Descriptive detail for one selected task (spec §50): title, description, agent, status,
 *  dependencies, acceptance criteria, attempts, timing. Generation history / diff review / test
 *  results / failure recovery are composed alongside this by `WorkflowPanel.tsx` using the existing
 *  `GenerationHistory`/`ChangePreview`/`TestResultsPanel`/`FailurePanel` components — this component
 *  only ever renders the plan/workflow's own descriptive fields, never re-implements any of those. */
export function TaskDetails({ task, taskState }: TaskDetailsProps) {
  const status = taskState?.status ?? WorkflowTaskStatus.PENDING;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{task.title}</h3>
        <Badge variant="outline" className="capitalize">
          {status.replace('_', ' ')}
        </Badge>
      </div>

      <p className="text-muted-foreground">{task.description}</p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Agent</dt>
        <dd className="capitalize">{taskState?.agentId ?? 'unassigned'}</dd>
        <dt className="text-muted-foreground">Priority</dt>
        <dd className="capitalize">{task.priority}</dd>
        <dt className="text-muted-foreground">Attempts</dt>
        <dd>{taskState?.attempts ?? 0}</dd>
        {taskState?.startedAt && (
          <>
            <dt className="text-muted-foreground">Started</dt>
            <dd>{new Date(taskState.startedAt).toLocaleTimeString()}</dd>
          </>
        )}
        {taskState?.completedAt && (
          <>
            <dt className="text-muted-foreground">Completed</dt>
            <dd>{new Date(taskState.completedAt).toLocaleTimeString()}</dd>
          </>
        )}
      </dl>

      {task.dependencies.length > 0 && (
        <p>
          <span className="text-muted-foreground">Depends on: </span>
          <span className="font-mono">{task.dependencies.join(', ')}</span>
        </p>
      )}

      {task.acceptanceCriteria.length > 0 && (
        <div>
          <p className="mb-0.5 text-muted-foreground">Acceptance criteria:</p>
          <ul className="flex flex-col gap-0.5">
            {task.acceptanceCriteria.map((criterion) => (
              <li key={criterion}>· {criterion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
