import { TaskExecutionStatus, type ITaskBoardItem } from 'shared';
import { TaskCard } from './TaskCard';

const COLUMNS: { status: TaskExecutionStatus; label: string }[] = [
  { status: TaskExecutionStatus.BLOCKED, label: 'Blocked' },
  { status: TaskExecutionStatus.READY, label: 'Ready' },
  { status: TaskExecutionStatus.RUNNING, label: 'Running' },
  { status: TaskExecutionStatus.FAILED, label: 'Failed' },
  { status: TaskExecutionStatus.COMPLETED, label: 'Completed' },
];

interface TaskListProps {
  tasks: ITaskBoardItem[];
  busyTaskId: string | null;
  onRun: (taskId: string) => void;
  onReview: (task: ITaskBoardItem) => void;
}

/** Frontend task board (spec §54) — visibility only, no orchestration. Only frontend-typed tasks
 *  are shown; backend/database/testing/etc. tasks belong to future agents and never appear here. */
export function TaskList({ tasks, busyTaskId, onRun, onReview }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No frontend tasks in this plan yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {COLUMNS.map(({ status, label }) => {
        const columnTasks = tasks.filter((task) => task.executionStatus === status);
        if (columnTasks.length === 0) return null;

        return (
          <div key={status} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label} ({columnTasks.length})
            </h3>
            <div className="flex flex-col gap-2">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isBusy={busyTaskId === task.id}
                  onRun={onRun}
                  onReview={onReview}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
