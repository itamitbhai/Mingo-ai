import { Request, Response } from 'express';
import { DeploymentConfigInput, DeploymentEnvironment } from 'shared';
import * as deploymentConfigService from '../services/deploymentConfig.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { EnvironmentQuery } from '../validators/deployment.validator';

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { environment } = req.query as unknown as EnvironmentQuery;
  const config = await deploymentConfigService.getDeploymentConfig(
    user._id,
    req.params.projectId,
    environment ?? DeploymentEnvironment.PRODUCTION
  );
  sendSuccess(res, config);
});

export const listConfigs = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const configs = await deploymentConfigService.listDeploymentConfigs(user._id, req.params.projectId);
  sendSuccess(res, configs);
});

export const upsertConfig = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as DeploymentConfigInput;
  const config = await deploymentConfigService.upsertDeploymentConfig(user._id, req.params.projectId, body);
  sendSuccess(res, config, 'Deployment configuration saved');
});
