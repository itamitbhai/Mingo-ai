import { Request, Response } from 'express';
import { CreateDeploymentInput, DeploymentEnvironment, DeploymentEventType, DeploymentHistoryQueryInput } from 'shared';
import * as deploymentService from '../services/deployment/deployment.service';
import { subscribe } from '../services/deployment/deployment.events';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const validateDeployment = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateDeploymentInput;
  const result = await deploymentService.validateDeployment(
    user._id,
    req.params.projectId,
    body.environment ?? DeploymentEnvironment.PRODUCTION,
    body.branch
  );
  sendSuccess(res, result);
});

export const createDeployment = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateDeploymentInput;
  const deployment = await deploymentService.createDeployment(user._id, req.params.projectId, body);
  sendCreated(res, deployment, 'Deployment started');
});

export const listHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as DeploymentHistoryQueryInput;
  const result = await deploymentService.listDeploymentHistory(user._id, req.params.projectId, query);
  sendSuccess(res, result);
});

export const getDeployment = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const deployment = await deploymentService.getDeployment(user._id, req.params.projectId, req.params.deploymentId);
  sendSuccess(res, deployment);
});

export const cancelDeployment = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const deployment = await deploymentService.cancelDeployment(user._id, req.params.projectId, req.params.deploymentId);
  sendSuccess(res, deployment, 'Cancelling deployment…');
});

export const rollbackDeployment = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const deployment = await deploymentService.rollbackDeployment(user._id, req.params.projectId, req.params.deploymentId);
  sendCreated(res, deployment, 'Rollback started');
});

const TERMINAL_EVENT_TYPES = new Set<string>([
  DeploymentEventType.SUCCESS,
  DeploymentEventType.FAILED,
  DeploymentEventType.CANCELLED,
]);

/** SSE tail (spec §11/§12/§34) — no buffered replay, same rationale as `sandbox.controller.ts`'s
 *  `streamSandboxEvents`: a client that connects after the fact reads the persisted `Deployment`
 *  document instead (`GET .../deployment/:deploymentId`), which already has the accumulated logs. */
export const streamDeploymentEvents = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { projectId, deploymentId } = req.params;

  await deploymentService.getDeployment(user._id, projectId, deploymentId);

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

  unsubscribe = subscribe(deploymentId, (event) => {
    write(event);
    if (TERMINAL_EVENT_TYPES.has(event.type)) close();
  });

  req.on('close', close);
});
