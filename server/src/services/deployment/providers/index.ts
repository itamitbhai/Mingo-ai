import { DeploymentOption } from 'shared';
import { ApiError } from '../../../utils/ApiError';
import { DeploymentProvider } from './deploymentProvider.interface';
import { railwayProvider } from './railwayProvider';
import { renderProvider } from './renderProvider';
import { vercelProvider } from './vercelProvider';

const PROVIDERS: Record<DeploymentOption, DeploymentProvider> = {
  [DeploymentOption.RENDER]: renderProvider,
  [DeploymentOption.VERCEL]: vercelProvider,
  [DeploymentOption.RAILWAY]: railwayProvider,
};

export function getProvider(option: DeploymentOption): DeploymentProvider {
  const provider = PROVIDERS[option];
  if (!provider) {
    throw ApiError.badRequest(`Unknown deployment provider "${option}".`);
  }
  return provider;
}

export type { DeploymentProvider, ProviderDeployHandle, ProviderDeployParams, ProviderDeployStatus } from './deploymentProvider.interface';
