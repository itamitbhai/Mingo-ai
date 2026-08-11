import { Request, Response } from 'express';
import { GeneratePlanInput } from 'shared';
import * as autopilotService from '../agents/autopilot/autopilot.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';

function describeAutopilotError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Mingo AI could not finish building this right now. Please try again in a moment.';
}

export const runAutopilot = asyncHandler(async (req: Request, res: Response) => {
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
    const result = await autopilotService.runAutopilot(
      user._id,
      projectId,
      body.prompt,
      body.conversationId,
      controller.signal,
      (event) => write({ type: 'stage', ...event })
    );

    write({ type: 'done', plan: result.plan, tasks: result.tasks, stoppedEarly: result.stoppedEarly });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }

    logger.error('autopilot.request.failed', err);
    write({ type: 'error', message: describeAutopilotError(err) });
    res.end();
  }
});
