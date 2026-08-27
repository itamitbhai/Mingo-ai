import { IPlanTask, IWorkflowEvent, WorkflowMode } from 'shared';
import { WorkflowTaskStateDoc } from '../models';

export type OnWorkflowEvent = (event: IWorkflowEvent) => void;

/** Adjacency-list view of a plan's tasks, built once per workflow run by `orchestrator.graph.ts`. */
export interface TaskGraph {
  tasks: Map<string, IPlanTask>;
  /** `dependents[taskId]` = every task that lists `taskId` as one of its `dependencies` — the
   *  reverse edge, used to find what a completed/skipped/failed task unlocks or blocks. */
  dependents: Map<string, string[]>;
}

export interface RunWorkflowOptions {
  mode: WorkflowMode;
  maxConcurrency: number;
}

/** In-memory-only control surface for a live run, keyed by workflow id in `orchestrator.ts`'s
 *  registry — mirrors `services/sandbox/run-registry.ts`'s single-instance `Map` precedent. */
export interface ActiveWorkflowHandle {
  paused: boolean;
  controller: AbortController;
}

export type TaskStateMap = Map<string, WorkflowTaskStateDoc>;
