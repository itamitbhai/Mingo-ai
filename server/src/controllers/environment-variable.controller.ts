import { Request, Response } from 'express';
import { CreateEnvironmentVariableInput, UpdateEnvironmentVariableInput } from 'shared';
import * as environmentVariableService from '../services/environmentVariable.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { EnvironmentQuery } from '../validators/deployment.validator';

export const listVariables = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { environment } = req.query as unknown as EnvironmentQuery;
  const variables = await environmentVariableService.listEnvironmentVariables(user._id, req.params.projectId, environment);
  sendSuccess(res, variables);
});

export const revealVariable = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const variable = await environmentVariableService.revealEnvironmentVariable(user._id, req.params.projectId, req.params.id);
  sendSuccess(res, variable);
});

export const createVariable = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateEnvironmentVariableInput;
  const variable = await environmentVariableService.createEnvironmentVariable(user._id, req.params.projectId, body);
  sendCreated(res, variable, `"${body.key}" added`);
});

export const updateVariable = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as UpdateEnvironmentVariableInput;
  const variable = await environmentVariableService.updateEnvironmentVariable(user._id, req.params.projectId, req.params.id, body);
  sendSuccess(res, variable, 'Environment variable updated');
});

export const deleteVariable = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  await environmentVariableService.deleteEnvironmentVariable(user._id, req.params.projectId, req.params.id);
  sendSuccess(res, { deleted: true }, 'Environment variable deleted');
});
