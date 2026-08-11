import { Request, Response } from 'express';
import { ApplyGenerationInput, RegenerateTaskInput, RejectGenerationInput } from 'shared';
import * as frontendAgentService from '../agents/frontend/frontend.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';

function describeFrontendAgentError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'The Frontend Agent could not generate changes right now. Please try again in a moment.';
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

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const tasks = await frontendAgentService.listTasksWithStatus(user._id, req.params.projectId, req.params.planId);
  sendSuccess(res, tasks);
});

export const executeTask = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, planId, taskId } = req.params;

  const write = openSSE(res);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const generation = await frontendAgentService.executeTask(
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

    logger.error('frontend_agent.request.failed', err);
    write({ type: 'error', message: describeFrontendAgentError(err) });
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
    const generation = await frontendAgentService.regenerateTask(
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

    logger.error('frontend_agent.request.failed', err);
    write({ type: 'error', message: describeFrontendAgentError(err) });
    res.end();
  }
});

export const listGenerations = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, planId, taskId } = req.params;
  const generations = await frontendAgentService.listGenerations(user._id, projectId, taskId, planId);
  sendSuccess(res, generations);
});

export const getGeneration = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const generation = await frontendAgentService.getGeneration(user._id, req.params.projectId, req.params.generationId);
  sendSuccess(res, generation);
});

export const applyGeneration = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as ApplyGenerationInput;
  const result = await frontendAgentService.applyGeneration(user._id, req.params.projectId, body.generationId);
  sendSuccess(res, result, 'Changes applied');
});

export const rejectGeneration = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as RejectGenerationInput;
  const generation = await frontendAgentService.rejectGeneration(user._id, req.params.projectId, body.generationId);
  sendSuccess(res, generation, 'Changes rejected');
});
