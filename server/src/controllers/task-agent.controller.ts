import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { IPlanTask, RegenerateTaskInput } from 'shared';
import * as plannerService from '../agents/planner/planner.service';
import * as frontendAgentService from '../agents/frontend/frontend.service';
import * as backendAgentService from '../agents/backend/backend.service';
import * as databaseAgentService from '../agents/database/database.service';
import * as testingAgentService from '../agents/testing/testing.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';

/**
 * Dispatches `POST .../tasks/:taskId/execute` and `.../regenerate` to whichever agent actually owns
 * the task (Phase 7 spec §39/§73, Phase 8 §11/§75) — the one place in the codebase that knows every
 * codegen agent exists. `listTasks`/`listGenerations`/`getGeneration` and `/workspace/ai/apply`/
 * `/reject` stay on the existing Phase 6 `frontendAgentController`/`frontendAgentService` routes
 * unchanged: those operations (looking up an `AgentGeneration`, previewing/applying a batch of file
 * operations) never depended on which agent produced the generation in the first place, so
 * duplicating them per agent would just be the same code three times over (spec §73/§75: "Do not
 * create duplicate APIs").
 *
 * A task that belongs to none of the four (devops/security/deployment) falls through to the Frontend
 * Agent's own `isFrontendTask` check, which already rejects it with a message naming the real
 * owning agent — reused here rather than reimplemented.
 */
async function resolveTask(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  taskId: string
): Promise<IPlanTask> {
  const plan = await plannerService.getPlan(owner, projectId, planId);
  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const task = tasks.find((candidate) => candidate.id === taskId);

  if (!task) {
    throw ApiError.notFound(`Task "${taskId}" was not found in this plan`);
  }

  return task;
}

function pickAgentService(task: IPlanTask) {
  if (backendAgentService.isBackendTask(task)) return backendAgentService;
  if (databaseAgentService.isDatabaseTask(task)) return databaseAgentService;
  if (testingAgentService.isTestingTask(task)) return testingAgentService;
  return frontendAgentService;
}

function describeTaskAgentError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'The agent could not generate changes right now. Please try again in a moment.';
}

function openSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

export const executeTask = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, planId, taskId } = req.params;

  const write = openSSE(res);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const task = await resolveTask(user._id, projectId, planId, taskId);
    const service = pickAgentService(task);

    const generation = await service.executeTask(
      user._id,
      projectId,
      planId,
      taskId,
      controller.signal,
      (event) => write({ type: 'stage', ...event })
    );

    write({ type: 'done', generation });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }

    logger.error('task_agent.request.failed', err);
    write({ type: 'error', message: describeTaskAgentError(err) });
    res.end();
  }
});

export const regenerateTask = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, planId, taskId } = req.params;
  const body = req.body as RegenerateTaskInput;

  const write = openSSE(res);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const task = await resolveTask(user._id, projectId, planId, taskId);
    const service = pickAgentService(task);

    const generation = await service.regenerateTask(
      user._id,
      projectId,
      planId,
      taskId,
      body.feedback,
      controller.signal,
      (event) => write({ type: 'stage', ...event })
    );

    write({ type: 'done', generation });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }

    logger.error('task_agent.request.failed', err);
    write({ type: 'error', message: describeTaskAgentError(err) });
    res.end();
  }
});
