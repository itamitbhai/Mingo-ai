import { Request, Response } from 'express';
import { CreateTestRunInput, TestRunQueryInput } from 'shared';
import * as testingAgentService from '../agents/testing/testing.service';
import * as runRegistry from '../services/sandbox/run-registry';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';

function describeTestRunError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Test execution could not complete right now. Please try again in a moment.';
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

/**
 * Creates a `TestRun` and streams its progress over SSE in one request — mirrors
 * `task-agent.controller.ts`'s `executeTask` exactly (stage events, then a final `{type:'done',...}`
 * or `{type:'error',...}`). The run is registered in the in-memory sandbox registry for the lifetime
 * of the request so `POST .../:testRunId/cancel` can abort it from a different request.
 */
export const createTestRun = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId } = req.params;
  const body = req.body as CreateTestRunInput;

  const write = openSSE(res);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  let testRunId: string | undefined;

  try {
    const testRun = await testingAgentService.createTestRun(user._id, projectId, body.planId, body.taskId, body.scope);
    testRunId = testRun.id;
    runRegistry.registerRun(testRun.id, controller);

    write({ type: 'queued', testRun });

    const completed = await testingAgentService.runTestRun(testRun, user._id, projectId, controller.signal, (event) =>
      write({ type: 'stage', ...event })
    );

    write({ type: 'done', testRun: completed });
    res.end();
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }

    logger.error('test_run.request.failed', err);
    write({ type: 'error', message: describeTestRunError(err) });
    res.end();
  } finally {
    if (testRunId) runRegistry.unregisterRun(testRunId);
  }
});

export const listTestRuns = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { planId, taskId } = req.query as unknown as TestRunQueryInput;
  const testRuns = await testingAgentService.listTestRuns(user._id, req.params.projectId, planId, taskId);
  sendSuccess(res, testRuns);
});

export const getTestRun = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const testRun = await testingAgentService.getTestRun(user._id, req.params.projectId, req.params.testRunId);
  sendSuccess(res, testRun);
});

export const cancelTestRun = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  // Verifies ownership before allowing the cancel signal through — a stale/foreign id 404s here
  // rather than silently no-op-ing via the registry lookup alone.
  await testingAgentService.getTestRun(user._id, req.params.projectId, req.params.testRunId);
  const cancelled = testingAgentService.cancelTestRun(req.params.testRunId);
  sendSuccess(res, { cancelled }, cancelled ? 'Cancelling test run…' : 'This test run is no longer active.');
});

export const explainFailure = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const resultIndex = Number(req.params.resultIndex);
  const analysis = await testingAgentService.explainTestFailure(
    user._id,
    req.params.projectId,
    req.params.testRunId,
    resultIndex,
    controller.signal
  );
  sendSuccess(res, analysis);
});

export const generateFix = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const resultIndex = Number(req.params.resultIndex);
  const generation = await testingAgentService.generateTestFix(
    user._id,
    req.params.projectId,
    req.params.testRunId,
    resultIndex,
    controller.signal
  );
  sendSuccess(res, generation, 'Fix ready for review');
});
