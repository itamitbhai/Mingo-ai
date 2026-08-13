import { Loader2, Play, RotateCcw, TestTube2, UserCog } from 'lucide-react';
import { TaskExecutionStatus, type ITaskBoardItem } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_VARIANT: Record<TaskExecutionStatus, 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  [TaskExecutionStatus.PENDING]: 'outline',
  [TaskExecutionStatus.READY]: 'default',
  [TaskExecutionStatus.RUNNING]: 'warning',
  [TaskExecutionStatus.COMPLETED]: 'success',
  [TaskExecutionStatus.FAILED]: 'destructive',
  [TaskExecutionStatus.CANCELLED]: 'secondary',
  [TaskExecutionStatus.BLOCKED]: 'secondary',
  [TaskExecutionStatus.SKIPPED]: 'secondary',
};

interface TaskCardProps {
  task: ITaskBoardItem;
  isBusy: boolean;
  onRun: (taskId: string) => void;
  onReview: (task: ITaskBoardItem) => void;
  onRunTests?: (task: ITaskBoardItem) => void;
}

/** Phase 9: a task is runnable from this board if the Frontend Agent (Phase 6), the Backend Agent
 *  (Phase 7), the Database Agent (Phase 8), or the Testing Agent (Phase 9) owns it — anything else
 *  (devops/security/deployment) still shows as "not available yet". */
function agentLabelFor(task: ITaskBoardItem): string {
  if (task.isFrontendTask) return 'Frontend Agent';
  if (task.isBackendTask) return 'Backend Agent';
  if (task.isDatabaseTask) return 'Database Agent';
  if (task.isTestingTask) return 'Testing Agent';
  return task.owningAgent ?? 'another agent';
}

export function TaskCard({ task, isBusy, onRun, onReview, onRunTests }: TaskCardProps) {
  const isExecutable = task.isFrontendTask || task.isBackendTask || task.isDatabaseTask || task.isTestingTask;
  const agentLabel = agentLabelFor(task);
  const hasPendingReview = Boolean(task.latestGenerationId) && task.executionStatus === TaskExecutionStatus.READY;
  const canRun =
    isExecutable &&
    !isBusy &&
    (task.executionStatus === TaskExecutionStatus.READY || task.executionStatus === TaskExecutionStatus.FAILED) &&
    !hasPendingReview;

  return (
    <Card className={isExecutable ? 'bg-card/60' : 'bg-card/30 opacity-75'}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
            <span className="text-sm font-semibold">{task.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="gap-1">
              <UserCog className="size-3" /> {agentLabel}
            </Badge>
            <Badge variant={STATUS_VARIANT[task.executionStatus]} className="capitalize">
              {task.executionStatus}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{task.description}</p>

        {task.dependencies.length > 0 && (
          <p className="text-xs">
            <span className="text-muted-foreground">Depends on: </span>
            <span className="font-mono">{task.dependencies.join(', ')}</span>
          </p>
        )}

        {task.error && <p className="text-xs text-destructive">{task.error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {!isExecutable ? (
            <span className="text-xs text-muted-foreground">
              Not available yet — {agentLabel} isn&apos;t built in this phase.
            </span>
          ) : (
            <>
              {hasPendingReview && (
                <Button size="sm" onClick={() => onReview(task)}>
                  Review Changes
                </Button>
              )}
              {task.executionStatus === TaskExecutionStatus.COMPLETED && task.latestGenerationId && (
                <Button size="sm" variant="outline" onClick={() => onReview(task)}>
                  View Changes
                </Button>
              )}
              {task.isTestingTask && task.executionStatus === TaskExecutionStatus.COMPLETED && onRunTests && (
                <Button size="sm" variant="outline" onClick={() => onRunTests(task)}>
                  <TestTube2 className="size-4" /> Run Tests
                </Button>
              )}
              {canRun && (
                <Button size="sm" variant="outline" onClick={() => onRun(task.id)} disabled={isBusy}>
                  {isBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : task.executionStatus === TaskExecutionStatus.FAILED ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {task.executionStatus === TaskExecutionStatus.FAILED ? 'Retry' : 'Run'}
                </Button>
              )}
              {task.executionStatus === TaskExecutionStatus.BLOCKED && (
                <span className="text-xs text-muted-foreground">Waiting for required tasks.</span>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
