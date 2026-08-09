import { Request, Response } from 'express';
import { GeneratePlanInput, PlansQueryInput, RegeneratePlanInput, UpdatePlanInput } from 'shared';
import * as plannerService from '../agents/planner/planner.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';

function describePlannerError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'The planner could not generate a plan right now. Please try again in a moment.';
}

export const generatePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const projectId = req.params.projectId;
  const body = req.body as GeneratePlanInput;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const write = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const plan = await plannerService.generatePlan(
      user._id,
      projectId,
      body.prompt,
      body.conversationId,
      controller.signal,
      (event) => write({ type: 'stage', ...event })
    );

    write({ type: 'done', plan });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }

    logger.error('planner.request.failed', err);
    write({ type: 'error', message: describePlannerError(err) });
    res.end();
  }
});

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as PlansQueryInput;
  const result = await plannerService.listPlans(user._id, req.params.projectId, query.page, query.limit);
  sendSuccess(res, result);
});

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const plan = await plannerService.getPlan(user._id, req.params.projectId, req.params.planId);
  sendSuccess(res, plan);
});

export const regeneratePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const projectId = req.params.projectId;
  const planId = req.params.planId;
  const body = req.body as RegeneratePlanInput;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const write = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const result = await plannerService.regeneratePlan(
      user._id,
      projectId,
      planId,
      body.prompt,
      controller.signal,
      (event) => write({ type: 'stage', ...event })
    );

    write({ type: 'done', plan: result.plan, previousPlan: result.previousPlan, diff: result.diff });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }

    logger.error('planner.request.failed', err);
    write({ type: 'error', message: describePlannerError(err) });
    res.end();
  }
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const projectId = req.params.projectId;
  const planId = req.params.planId;
  const body = req.body as UpdatePlanInput;

  let plan = await plannerService.getPlan(user._id, projectId, planId);

  if (body.status) {
    plan = await plannerService.updatePlanStatus(user._id, projectId, planId, body.status);
  }

  if (body.featureEdits?.length || body.taskEdits?.length) {
    plan = await plannerService.updatePlanFields(user._id, projectId, planId, {
      featureEdits: body.featureEdits,
      taskEdits: body.taskEdits,
    });
  }

  sendSuccess(res, plan, 'Plan updated');
});

export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  await plannerService.deletePlan(user._id, req.params.projectId, req.params.planId);
  sendSuccess(res, null, 'Plan deleted');
});
