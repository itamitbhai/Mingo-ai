import { Types } from 'mongoose';
import { IAutopilotTaskResult, IPlanTask } from 'shared';
import { ProjectPlanDocument } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as frontendAgentService from '../frontend/frontend.service';
import * as plannerService from '../planner/planner.service';
import { OnAutopilotStage } from './autopilot.types';

export interface AutopilotRunResult {
  plan: ProjectPlanDocument;
  tasks: IAutopilotTaskResult[];
  stoppedEarly: boolean;
}

/** `plan.executionOrder` is neither Zod- nor Mongoose-validated against `plan.tasks` ids, so this
 *  defensively keeps only ids that resolve to a real task, then appends anything `executionOrder`
 *  left out (spec parity with a plan that omits it entirely). */
function resolveTaskOrder(plan: ProjectPlanDocument): IPlanTask[] {
  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const ordered: IPlanTask[] = [];

  for (const id of plan.executionOrder ?? []) {
    const task = byId.get(id);
    if (task && !seen.has(id)) {
      ordered.push(task);
      seen.add(id);
    }
  }

  for (const task of tasks) {
    if (!seen.has(task.id)) {
      ordered.push(task);
      seen.add(task.id);
    }
  }

  return ordered;
}

function describeTaskError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'This task could not be generated.';
}

/**
 * Composes the existing Planner + Frontend Agent service functions into one end-to-end run:
 * generate a plan, auto-approve it, then run and auto-apply every frontend-owned task in order —
 * no AI-calling, validation, locking, or file-writing logic is reimplemented here (spec: additive
 * "Build It Now" path, manual review flow untouched).
 *
 * Once the per-task loop starts, this always *resolves* with a structured result — a single task
 * failing is a normal outcome (`outcome: 'failed'`), not a thrown error, so the caller can render
 * "2 of 4 done, task 3 failed, task 4 not attempted" instead of losing that detail to a bare
 * exception. It only throws for failures before the loop (plan generation/approval) or a
 * client-driven abort, matching every other agent entry point's throw-on-failure contract.
 */
export async function runAutopilot(
  owner: Types.ObjectId,
  projectId: string,
  prompt: string,
  conversationId: string | undefined,
  signal: AbortSignal,
  onStage?: OnAutopilotStage
): Promise<AutopilotRunResult> {
  logger.info('autopilot.started', { projectId, userId: owner.toString() });

  const plan = await plannerService.generatePlan(owner, projectId, prompt, conversationId, signal, (event) =>
    onStage?.({ phase: 'planning', ...event })
  );

  onStage?.({ phase: 'approving', label: 'Approving the plan…' });
  const approvedPlan = await plannerService.updatePlanStatus(owner, projectId, plan.id, 'approved');

  const orderedTasks = resolveTaskOrder(approvedPlan);
  const results: IAutopilotTaskResult[] = [];
  let stoppedEarly = false;

  for (let i = 0; i < orderedTasks.length; i++) {
    const task = orderedTasks[i];
    const taskIndex = i + 1;
    const taskCount = orderedTasks.length;

    if (signal.aborted) {
      throw new Error('Autopilot run aborted');
    }

    if (!frontendAgentService.isFrontendTask(task)) {
      const reason = frontendAgentService.describeOwningAgent(task);
      results.push({ taskId: task.id, title: task.title, outcome: 'skipped', reason });
      onStage?.({
        phase: 'task',
        stage: 'skipped',
        label: `Skipping "${task.title}" — ${reason}`,
        taskId: task.id,
        taskTitle: task.title,
        taskIndex,
        taskCount,
      });
      continue;
    }

    try {
      const generation = await frontendAgentService.executeTask(
        owner,
        projectId,
        approvedPlan.id,
        task.id,
        signal,
        (event) => onStage?.({ phase: 'task', ...event, taskId: task.id, taskTitle: task.title, taskIndex, taskCount })
      );

      onStage?.({
        phase: 'task',
        stage: 'applying',
        label: `Applying "${task.title}"…`,
        taskId: task.id,
        taskTitle: task.title,
        taskIndex,
        taskCount,
      });

      await frontendAgentService.applyGeneration(owner, projectId, generation.id);

      results.push({ taskId: task.id, title: task.title, outcome: 'completed', generationId: generation.id });
    } catch (err) {
      const message = describeTaskError(err);
      results.push({ taskId: task.id, title: task.title, outcome: 'failed', error: message });
      logger.error('autopilot.task.failed', { projectId, planId: approvedPlan.id, taskId: task.id, error: err });
      stoppedEarly = true;
      break;
    }
  }

  if (stoppedEarly) {
    const attempted = new Set(results.map((result) => result.taskId));
    for (const task of orderedTasks) {
      if (!attempted.has(task.id)) {
        results.push({ taskId: task.id, title: task.title, outcome: 'not_attempted' });
      }
    }
  }

  logger.info('autopilot.completed', { projectId, planId: approvedPlan.id, stoppedEarly });

  return { plan: approvedPlan, tasks: results, stoppedEarly };
}
