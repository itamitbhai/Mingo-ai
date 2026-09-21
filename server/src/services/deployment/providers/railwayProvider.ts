import { DeploymentOption } from 'shared';
import { ApiError } from '../../../utils/ApiError';
import { DeploymentProvider } from './deploymentProvider.interface';

/** Interface-conformant stub — see `vercelProvider.ts` for the rationale. */
const notConfigured = () => {
  throw ApiError.badRequest('The Railway provider is not configured yet. Use Render for now.');
};

export const railwayProvider: DeploymentProvider = {
  name: DeploymentOption.RAILWAY,
  isConfigured: () => false,
  deploy: async () => notConfigured(),
  getDeploymentStatus: async () => notConfigured(),
  cancelDeployment: async () => notConfigured(),
  getLiveUrl: async () => notConfigured(),
};
