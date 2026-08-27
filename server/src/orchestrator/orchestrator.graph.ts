import { IPlanTask, WorkflowTaskStatus } from 'shared';
import { TaskGraph, TaskStateMap } from './orchestrator.types';

/** Builds the adjacency-list view of a plan's tasks (Phase 10 spec §3/§4) — pure, no I/O. */
export function buildGraph(tasks: IPlanTask[]): TaskGraph {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      if (!taskMap.has(dependencyId)) continue; // a dangling dependency id is a data problem, not a cycle
      const list = dependents.get(dependencyId) ?? [];
      list.push(task.id);
      dependents.set(dependencyId, list);
    }
  }

  return { tasks: taskMap, dependents };
}

/**
 * Rejects a plan whose `dependencies` form a cycle (spec §4: `A → B → C → A` must be rejected) —
 * standard DFS with a recursion stack. Returns the cycle's task ids in order if one exists, else
 * `null`.
 */
export function detectCycle(graph: TaskGraph): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const path: string[] = [];

  function visit(taskId: string): string[] | null {
    color.set(taskId, GRAY);
    path.push(taskId);

    const task = graph.tasks.get(taskId);
    for (const dependencyId of task?.dependencies ?? []) {
      if (!graph.tasks.has(dependencyId)) continue;

      const state = color.get(dependencyId) ?? WHITE;
      if (state === GRAY) {
        const cycleStart = path.indexOf(dependencyId);
        return [...path.slice(cycleStart), dependencyId];
      }
      if (state === WHITE) {
        const found = visit(dependencyId);
        if (found) return found;
      }
    }

    color.set(taskId, BLACK);
    path.pop();
    return null;
  }

  for (const taskId of graph.tasks.keys()) {
    if ((color.get(taskId) ?? WHITE) === WHITE) {
      const cycle = visit(taskId);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Every task whose dependencies are all `completed` and that hasn't itself already been
 * started/finished (spec §11 step 2-3). A `skipped` dependency does NOT satisfy a dependent — spec
 * §37: "If a required task is skipped, dependent tasks should become BLOCKED unless explicitly
 * overridden," and this pass doesn't implement an override, so skipped deps simply never unlock.
 */
export function computeReadyTasks(graph: TaskGraph, taskStates: TaskStateMap): IPlanTask[] {
  const ready: IPlanTask[] = [];

  for (const task of graph.tasks.values()) {
    const state = taskStates.get(task.id);
    const notYetStarted =
      !state ||
      state.status === WorkflowTaskStatus.PENDING ||
      state.status === WorkflowTaskStatus.BLOCKED ||
      state.status === WorkflowTaskStatus.READY;

    if (!notYetStarted) continue;

    const dependenciesSatisfied = task.dependencies.every(
      (dependencyId) => taskStates.get(dependencyId)?.status === WorkflowTaskStatus.COMPLETED
    );

    if (dependenciesSatisfied) {
      ready.push(task);
    }
  }

  return ready;
}

/** A task is permanently unreachable once any of its dependencies has terminally failed/been
 *  skipped/cancelled without completing — used to mark dependents `blocked` rather than leaving them
 *  `pending` forever with no explanation (spec §24/§37). */
export function computeBlockedTasks(graph: TaskGraph, taskStates: TaskStateMap): IPlanTask[] {
  const blocked: IPlanTask[] = [];
  const terminalNonCompleted: WorkflowTaskStatus[] = [
    WorkflowTaskStatus.FAILED,
    WorkflowTaskStatus.CANCELLED,
    WorkflowTaskStatus.SKIPPED,
  ];

  for (const task of graph.tasks.values()) {
    const state = taskStates.get(task.id);
    const notYetStarted =
      !state || state.status === WorkflowTaskStatus.PENDING || state.status === WorkflowTaskStatus.BLOCKED;
    if (!notYetStarted) continue;

    const hasUnrecoverableDependency = task.dependencies.some((dependencyId) => {
      const dependencyStatus = taskStates.get(dependencyId)?.status;
      return dependencyStatus && terminalNonCompleted.includes(dependencyStatus);
    });

    if (hasUnrecoverableDependency) {
      blocked.push(task);
    }
  }

  return blocked;
}
