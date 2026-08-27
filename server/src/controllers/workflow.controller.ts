import { Request, Response } from 'express';
import { CreateWorkflowInput, WorkflowEventType } from 'shared';
import * as orchestratorService from '../orchestrator/orchestrator.service';
import { toCreateWorkflowParams } from '../orchestrator/orchestrator.schema';
import { subscribe } from '../orchestrator/orchestrator.events';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

/** Plain JSON — deliberately NOT SSE, unlike every prior agent's execute endpoint (spec's chosen
 *  execution model, see the Phase 10 plan's Context): plan generation (if any) still happens here
 *  synchronously, but task execution continues detached after this responds. Clients watch progress
 *  via `GET /:workflowId/events`. */
export const createWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId } = req.params;
  const body = req.body as CreateWorkflowInput;

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const workflow = await orchestratorService.createWorkflow({
    owner: user._id,
    projectId,
    signal: controller.signal,
    ...toCreateWorkflowParams(body),
  });
  sendCreated(res, workflow, 'Workflow started');
});

export const listWorkflows = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workflows = await orchestratorService.listWorkflows(user._id, req.params.projectId);
  sendSuccess(res, workflows);
});

export const getWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workflow = await orchestratorService.getWorkflow(user._id, req.params.projectId, req.params.workflowId);
  sendSuccess(res, workflow);
});

export const pauseWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workflow = await orchestratorService.pauseWorkflow(user._id, req.params.projectId, req.params.workflowId);
  sendSuccess(res, workflow, 'Pausing workflow…');
});

export const resumeWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workflow = await orchestratorService.resumeWorkflow(user._id, req.params.projectId, req.params.workflowId);
  sendSuccess(res, workflow, 'Resuming workflow…');
});

export const cancelWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workflow = await orchestratorService.cancelWorkflow(user._id, req.params.projectId, req.params.workflowId);
  sendSuccess(res, workflow, 'Cancelling workflow…');
});

export const retryTask = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workflow = await orchestratorService.retryTask(
    user._id,
    req.params.projectId,
    req.params.workflowId,
    req.params.taskId
  );
  sendSuccess(res, workflow, 'Retrying task…');
});

const TERMINAL_EVENT_TYPES = new Set<string>([
  WorkflowEventType.WORKFLOW_COMPLETED,
  WorkflowEventType.WORKFLOW_FAILED,
  WorkflowEventType.WORKFLOW_CANCELLED,
]);

/**
 * SSE tail — replays this workflow's buffered event log immediately on connect (so a client that
 * attaches after the workflow already started something isn't blind to it), then streams live events
 * off the in-process bus until the workflow reaches a terminal state or the client disconnects
 * (spec §19-21). No polling: `orchestrator.events.subscribe` is a real push, not an interval.
 */
export const streamWorkflowEvents = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, workflowId } = req.params;

  // Ownership check before opening the stream — a foreign/nonexistent workflow id 404s here.
  const workflow = await orchestratorService.getWorkflow(user._id, projectId, workflowId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const write = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  for (const event of workflow.events) {
    write({ type: 'replay', event });
  }

  let unsubscribe = () => {};

  const close = () => {
    unsubscribe();
    res.end();
  };

  unsubscribe = subscribe(workflowId, (event) => {
    write({ type: 'live', event });
    if (TERMINAL_EVENT_TYPES.has(event.type)) close();
  });

  req.on('close', close);
});
