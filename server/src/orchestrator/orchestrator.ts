import { Types } from 'mongoose';
import { IPlanTask, TaskExecutionStatus, WorkflowEventType, WorkflowStatus, WorkflowTaskStatus } from 'shared';
import { TaskExecutionModel, WorkflowDocument, WorkflowModel } from '../models';
import * as plannerService from '../agents/planner/planner.service';
import { logger } from '../utils/logger';
import { getAgentIdForTask } from './agent-registry';
import { executeWorkflowTask } from './orchestrator.executor';
import { publish } from './orchestrator.events';
import { buildGraph, computeBlockedTasks, computeReadyTasks } from './orchestrator.graph';
import { runTestingAndFixLoop } from './orchestrator.recovery';
import { shouldRetry } from './orchestrator.retry';
import { selectNextBatch } from './orchestrator.scheduler';
import { ActiveWorkflowHandle } from './orchestrator.types';
import { validateWorkflowCompletion } from './orchestrator.validator';

/** Same single-instance, in-memory `Map` precedent as `services/sandbox/run-registry.ts` — `pause`
 *  flips a flag the loop checks between rounds (never interrupts an in-flight agent call, spec §54),
 *  `cancel` aborts the controller threaded through every agent call this workflow makes. */
const activeWorkflows = new Map<string, ActiveWorkflowHandle>();

export function isWorkflowActive(workflowId: string): boolean {
  return activeWorkflows.has(workflowId);
}

export function requestPause(workflowId: string): boolean {
  const handle = activeWorkflows.get(workflowId);
  if (!handle) return false;
  handle.paused = true;
  return true;
}

export function requestResumeFlag(workflowId: string): boolean {
  const handle = activeWorkflows.get(workflowId);
  if (!handle) return false;
  handle.paused = false;
  return true;
}

export function requestCancel(workflowId: string): boolean {
  const handle = activeWorkflows.get(workflowId);
  if (!handle) return false;
  handle.controller.abort();
  return true;
}

function findTaskState(workflow: WorkflowDocument, taskId: string) {
  return workflow.tasks.find((task) => task.taskId === taskId);
}

/**
 * Reconciles `Workflow.tasks` against the real `TaskExecutionModel` state before (re)starting the
 * loop (spec §33 "Resume") — the source of truth for "did this task's generation actually get
 * applied" is `TaskExecutionModel`, not this workflow's own cached status, since a `needs_review` task
 * is applied through the existing, unmodified apply/reject UI, entirely outside the orchestrator's own
 * write path. This is also what makes a manual Resume click after a server restart work correctly:
 * nothing here assumes in-memory continuity.
 */
async function reconcileTaskStates(workflow: WorkflowDocument): Promise<void> {
  const pendingReview = workflow.tasks.filter((task) => task.status === WorkflowTaskStatus.NEEDS_REVIEW);
  if (pendingReview.length === 0) return;

  const executions = await TaskExecutionModel.find({
    plan: workflow.plan,
    taskId: { $in: pendingReview.map((task) => task.taskId) },
  });
  const executionByTaskId = new Map(executions.map((execution) => [execution.taskId, execution]));

  let changed = false;
  for (const taskState of pendingReview) {
    const execution = executionByTaskId.get(taskState.taskId);
    if (execution?.status === TaskExecutionStatus.COMPLETED) {
      taskState.status = WorkflowTaskStatus.COMPLETED;
      taskState.completedAt = new Date();
      changed = true;
    } else if (execution?.status === TaskExecutionStatus.CANCELLED) {
      taskState.status = WorkflowTaskStatus.CANCELLED;
      changed = true;
    }
  }

  if (changed) {
    workflow.markModified('tasks');
    await workflow.save();
  }
}

async function updateTaskState(
  workflowId: string,
  taskId: string,
  patch: Partial<{
    status: WorkflowTaskStatus;
    attempts: number;
    generationIds: string[];
    error: string;
    failureCategory: string;
    startedAt: Date;
    completedAt: Date;
  }>
): Promise<WorkflowDocument> {
  const workflow = await WorkflowModel.findById(workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} disappeared mid-run`);

  const state = findTaskState(workflow, taskId);
  if (state) Object.assign(state, patch);
  workflow.markModified('tasks');
  await workflow.save();
  return workflow;
}

/** Checked between scheduling rounds only — an in-flight agent call always runs to completion
 *  (spec §54). Polls at a coarse interval since pausing is a rare, human-paced action. */
async function waitWhilePaused(workflowId: string, handle: ActiveWorkflowHandle): Promise<void> {
  if (!handle.paused) return;

  await WorkflowModel.findByIdAndUpdate(workflowId, { status: WorkflowStatus.PAUSED });
  await publish(workflowId, {
    type: WorkflowEventType.WORKFLOW_PAUSED,
    status: WorkflowStatus.PAUSED,
    message: 'Workflow paused.',
  });

  while (handle.paused && !handle.controller.signal.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!handle.controller.signal.aborted) {
    await WorkflowModel.findByIdAndUpdate(workflowId, { status: WorkflowStatus.RUNNING });
    await publish(workflowId, {
      type: WorkflowEventType.WORKFLOW_RESUMED,
      status: WorkflowStatus.RUNNING,
      message: 'Workflow resumed.',
    });
  }
}

/**
 * The detached execution loop (Phase 10 spec §11) — started by `orchestrator.service.createWorkflow`/
 * `resumeWorkflow` via `void runWorkflow(...)` and left running independent of whatever HTTP request
 * triggered it. Exits in one of three ways: cancelled (signal aborted), waiting for human review
 * (nothing left ready/running, but some task is `needs_review` — the workflow is left in
 * `waiting_for_approval` and this function returns, freeing the in-memory handle; Resume restarts it),
 * or truly done (final validation decides `completed` vs `failed`).
 */
export async function runWorkflow(workflowId: string, owner: Types.ObjectId, projectId: string): Promise<void> {
  if (activeWorkflows.has(workflowId)) return; // already running — never double-drive the same workflow

  const handle: ActiveWorkflowHandle = { paused: false, controller: new AbortController() };
  activeWorkflows.set(workflowId, handle);

  try {
    let workflow = await WorkflowModel.findById(workflowId);
    if (!workflow) return;

    await reconcileTaskStates(workflow);

    const plan = await plannerService.getPlan(owner, projectId, workflow.plan.toString());
    const tasks = (plan.tasks ?? []) as IPlanTask[];
    const graph = buildGraph(tasks);

    workflow.status = WorkflowStatus.RUNNING;
    workflow.startedAt = workflow.startedAt ?? new Date();
    await workflow.save();
    await publish(workflowId, {
      type: WorkflowEventType.WORKFLOW_STARTED,
      status: WorkflowStatus.RUNNING,
      message: 'Workflow started.',
    });

    const running = new Set<string>();

    runLoop: while (true) {
      if (handle.controller.signal.aborted) break;
      await waitWhilePaused(workflowId, handle);
      if (handle.controller.signal.aborted) break;

      workflow = (await WorkflowModel.findById(workflowId))!;
      let taskStateMap = new Map(workflow.tasks.map((task) => [task.taskId, task]));

      const newlyBlocked = computeBlockedTasks(graph, taskStateMap);
      for (const task of newlyBlocked) {
        await updateTaskState(workflowId, task.id, { status: WorkflowTaskStatus.BLOCKED });
      }

      workflow = (await WorkflowModel.findById(workflowId))!;
      taskStateMap = new Map(workflow.tasks.map((task) => [task.taskId, task]));
      const ready = computeReadyTasks(graph, taskStateMap).filter((task) => !running.has(task.id));

      if (ready.length === 0 && running.size === 0) {
        const stillPendingReview = workflow.tasks.some((task) => task.status === WorkflowTaskStatus.NEEDS_REVIEW);
        if (stillPendingReview) {
          workflow.status = WorkflowStatus.WAITING_FOR_APPROVAL;
          await workflow.save();
          await publish(workflowId, {
            type: WorkflowEventType.TASK_NEEDS_REVIEW,
            status: WorkflowStatus.WAITING_FOR_APPROVAL,
            message: 'Waiting for review — approve the pending changes, then Resume.',
          });
          return;
        }
        break runLoop; // nothing left ready, running, or waiting — truly done
      }

      const batch = selectNextBatch(ready, running.size, workflow.maxConcurrency);

      if (batch.length === 0) {
        // ready tasks exist but every one was held back by the file-conflict pre-check, or we're
        // simply waiting on in-flight tasks to free up concurrency slots.
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      for (const task of batch) {
        running.add(task.id);
        await updateTaskState(workflowId, task.id, { status: WorkflowTaskStatus.QUEUED });
      }

      await Promise.all(
        batch.map(async (task) => {
          await updateTaskState(workflowId, task.id, { status: WorkflowTaskStatus.RUNNING, startedAt: new Date() });
          await publish(workflowId, {
            type: WorkflowEventType.TASK_READY,
            taskId: task.id,
            agentId: getAgentIdForTask(task),
            message: `Dispatching "${task.title}"…`,
          });

          const result = await executeWorkflowTask({
            owner,
            projectId,
            planId: workflow!.plan.toString(),
            workflowId,
            task,
            mode: workflow!.mode,
            signal: handle.controller.signal,
          });

          const before = await WorkflowModel.findById(workflowId);
          const priorState = before ? findTaskState(before, task.id) : undefined;
          const attempts = (priorState?.attempts ?? 0) + 1;
          const priorGenerationIds = priorState?.generationIds ?? [];
          const generationIds = result.generationId ? [...priorGenerationIds, result.generationId] : priorGenerationIds;

          if (result.status === WorkflowTaskStatus.FAILED && result.failureCategory && shouldRetry(result.failureCategory, priorState?.attempts ?? 0)) {
            await publish(workflowId, {
              type: WorkflowEventType.TASK_RETRYING,
              taskId: task.id,
              message: `Retrying "${task.title}" (attempt ${attempts + 1})…`,
            });
            await updateTaskState(workflowId, task.id, {
              status: WorkflowTaskStatus.READY,
              attempts,
              error: result.error,
              failureCategory: result.failureCategory,
            });
          } else if (result.status === WorkflowTaskStatus.COMPLETED) {
            await updateTaskState(workflowId, task.id, {
              status: WorkflowTaskStatus.COMPLETED,
              attempts,
              generationIds,
              completedAt: new Date(),
            });

            if (getAgentIdForTask(task) === 'testing') {
              await WorkflowModel.findByIdAndUpdate(workflowId, { status: WorkflowStatus.TESTING });
              const fixResult = await runTestingAndFixLoop({
                owner,
                projectId,
                planId: workflow!.plan.toString(),
                workflowId,
                taskId: task.id,
                mode: workflow!.mode,
                signal: handle.controller.signal,
              });
              if (!fixResult.passed) {
                await updateTaskState(workflowId, task.id, { status: WorkflowTaskStatus.NEEDS_REVIEW, error: fixResult.message });
              }
              await WorkflowModel.findByIdAndUpdate(workflowId, { status: WorkflowStatus.RUNNING });
            }
          } else if (result.status === WorkflowTaskStatus.NEEDS_REVIEW) {
            await updateTaskState(workflowId, task.id, { status: WorkflowTaskStatus.NEEDS_REVIEW, attempts, generationIds });
          } else {
            await updateTaskState(workflowId, task.id, {
              status: WorkflowTaskStatus.FAILED,
              attempts,
              error: result.error,
              failureCategory: result.failureCategory,
              completedAt: new Date(),
            });
          }

          running.delete(task.id);
        })
      );
    }

    workflow = (await WorkflowModel.findById(workflowId))!;

    if (handle.controller.signal.aborted) {
      workflow.status = WorkflowStatus.CANCELLED;
      workflow.completedAt = new Date();
      await workflow.save();
      await publish(workflowId, {
        type: WorkflowEventType.WORKFLOW_CANCELLED,
        status: WorkflowStatus.CANCELLED,
        message: 'Workflow cancelled.',
      });
      return;
    }

    const validation = await validateWorkflowCompletion(owner, projectId, workflow);
    workflow.status = validation.ready ? WorkflowStatus.COMPLETED : WorkflowStatus.FAILED;
    if (!validation.ready) workflow.error = validation.reasons.join('; ').slice(0, 1000);
    workflow.completedAt = new Date();
    await workflow.save();

    await publish(workflowId, {
      type: validation.ready ? WorkflowEventType.WORKFLOW_COMPLETED : WorkflowEventType.WORKFLOW_FAILED,
      status: workflow.status,
      message: validation.ready ? 'Project ready.' : `Project not ready: ${workflow.error}`,
    });

    logger.info('orchestrator.workflow.finished', { workflowId, status: workflow.status });
  } catch (err) {
    logger.error('orchestrator.run.failed', { workflowId, error: err instanceof Error ? err.message : err });
    await WorkflowModel.findByIdAndUpdate(workflowId, {
      status: WorkflowStatus.FAILED,
      error: (err instanceof Error ? err.message : 'Workflow failed').slice(0, 1000),
      completedAt: new Date(),
    }).catch(() => undefined);
    await publish(workflowId, {
      type: WorkflowEventType.WORKFLOW_FAILED,
      status: WorkflowStatus.FAILED,
      message: 'Workflow failed unexpectedly.',
    }).catch(() => undefined);
  } finally {
    activeWorkflows.delete(workflowId);
  }
}
