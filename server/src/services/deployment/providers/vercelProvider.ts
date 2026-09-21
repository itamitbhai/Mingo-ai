import { DeploymentOption } from 'shared';
import { ApiError } from '../../../utils/ApiError';
import { DeploymentProvider } from './deploymentProvider.interface';

/** Interface-conformant stub (Phase 13 spec §3/§35) — every method fails with a clear, honest error
 *  rather than pretending to deploy. Real when the user prioritizes it; the provider abstraction
 *  means only this file (plus `providers/index.ts`'s factory) needs to change to make it real. */
const notConfigured = () => {
  throw ApiError.badRequest('The Vercel provider is not configured yet. Use Render for now.');
};

export const vercelProvider: DeploymentProvider = {
  name: DeploymentOption.VERCEL,
  isConfigured: () => false,
  deploy: async () => notConfigured(),
  getDeploymentStatus: async () => notConfigured(),
  cancelDeployment: async () => notConfigured(),
  getLiveUrl: async () => notConfigured(),
};
