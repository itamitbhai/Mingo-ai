import { Request, Response } from 'express';
import { CreateSandboxRunInput, SandboxEventType } from 'shared';
import * as sandboxService from '../sandbox/sandbox.service';
import { subscribe } from '../sandbox/sandbox.events';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

/** Plain JSON — deliberately NOT SSE, same execution model as Phase 10's workflows: the container
 *  lifecycle continues after this responds. Clients watch progress via `GET /:sandboxId/events`. */
export const createSandboxRun = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateSandboxRunInput;
  const session = await sandboxService.createSandboxRun(user._id, req.params.projectId, body);
  sendCreated(res, session, 'Sandbox started');
});

export const listSandboxRuns = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const sessions = await sandboxService.listSandboxRuns(user._id, req.params.projectId);
  sendSuccess(res, sessions);
});

export const getSandboxRun = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const session = await sandboxService.getSandboxRun(user._id, req.params.projectId, req.params.sandboxId);
  sendSuccess(res, session);
});

export const stopSandboxRun = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const session = await sandboxService.stopSandboxRun(user._id, req.params.projectId, req.params.sandboxId);
  sendSuccess(res, session, 'Stopping sandbox…');
});

const TERMINAL_EVENT_TYPES = new Set<string>([
  SandboxEventType.TERMINAL_EXIT,
  SandboxEventType.TERMINAL_TIMEOUT,
  SandboxEventType.TERMINAL_CANCELLED,
  SandboxEventType.SANDBOX_DESTROYED,
]);

/** SSE tail (spec §13/§65) — the sandbox may already be running by the time this connects; there's no
 *  buffered replay here (unlike workflows) since a sandbox is short-lived and its final result is
 *  already on the `SandboxSession` document itself (`GET /:sandboxId`) the moment it finishes. */
export const streamSandboxEvents = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, sandboxId } = req.params;

  // Ownership check before opening the stream.
  await sandboxService.getSandboxRun(user._id, projectId, sandboxId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const write = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let unsubscribe = () => {};
  const close = () => {
    unsubscribe();
    res.end();
  };

  unsubscribe = subscribe(sandboxId, (event) => {
    write(event);
    if (TERMINAL_EVENT_TYPES.has(event.type)) close();
  });

  req.on('close', close);
});
