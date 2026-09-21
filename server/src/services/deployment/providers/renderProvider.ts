import { DeploymentOption } from 'shared';
import { env } from '../../../config/env';
import { ApiError } from '../../../utils/ApiError';
import { logger } from '../../../utils/logger';
import {
  DeploymentProvider,
  ProviderDeployHandle,
  ProviderDeployParams,
  ProviderDeployPhase,
  ProviderDeployStatus,
} from './deploymentProvider.interface';

const RENDER_API_BASE = 'https://api.render.com/v1';

/** Render's own deploy status strings (verified against api-docs.render.com/reference/retrieve-deploy),
 *  mapped into this app's provider-agnostic `ProviderDeployPhase`. */
const LIVE_STATUSES = new Set(['live']);
const FAILED_STATUSES = new Set(['build_failed', 'update_failed', 'pre_deploy_failed', 'deactivated']);
const CANCELLED_STATUSES = new Set(['canceled']);
const IN_PROGRESS_STATUSES = new Set([
  'created',
  'queued',
  'build_in_progress',
  'update_in_progress',
  'pre_deploy_in_progress',
]);

function mapPhase(status: string): ProviderDeployPhase {
  if (LIVE_STATUSES.has(status)) return 'live';
  if (CANCELLED_STATUSES.has(status)) return 'cancelled';
  if (FAILED_STATUSES.has(status)) return 'failed';
  if (IN_PROGRESS_STATUSES.has(status)) return 'in_progress';
  // An unrecognized status from a future Render API change — treated as still in progress rather
  // than silently reported as success or a hard failure either way; the caller keeps polling until
  // it either resolves to a known status or the pipeline's own timeout trips.
  logger.warn('render_provider.unknown_status', { status });
  return 'in_progress';
}

async function renderRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.RENDER_API_KEY) {
    throw ApiError.badRequest('The Render provider is not configured (missing RENDER_API_KEY).');
  }

  let response: Response;
  try {
    response = await fetch(`${RENDER_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RENDER_API_KEY}`,
        ...init.headers,
      },
    });
  } catch (err) {
    logger.error('render_provider.network_error', { path, error: err instanceof Error ? err.message : err });
    throw new ApiError(502, 'Could not reach Render. Please try again.');
  }

  if (response.status === 401 || response.status === 403) {
    throw ApiError.unauthorized('Render rejected the configured API key. Check RENDER_API_KEY.');
  }
  if (response.status === 429) {
    throw new ApiError(429, 'Render API rate limit reached. Please try again later.');
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error('render_provider.api_error', { path, status: response.status, body: body.slice(0, 500) });
    throw ApiError.badRequest(`Render rejected the request (${response.status}). Check your deployment configuration.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

interface RenderOwner {
  owner: { id: string; name: string; type: 'user' | 'team' };
}

let cachedOwnerId: string | null = null;

/** Uses the first workspace owner returned by Render (spec-honest limitation: a Render account with
 *  multiple teams needs explicit owner selection, not built this pass — surfaced here rather than
 *  silently guessed differently each call). */
async function resolveOwnerId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId;

  const owners = await renderRequest<RenderOwner[]>('/owners?limit=1');
  const owner = owners[0]?.owner;
  if (!owner) {
    throw ApiError.badRequest('No Render workspace found for this API key.');
  }
  cachedOwnerId = owner.id;
  return owner.id;
}

interface RenderService {
  id: string;
  name: string;
  type: string;
  serviceDetails?: { url?: string };
}

/** The list endpoint wraps each item as `{ service, cursor }` for pagination (verified against the
 *  real API — the single-resource `GET /services/{id}` used elsewhere in this file is NOT wrapped
 *  this way, only this cursor-paginated list is). */
interface RenderServiceListItem {
  service: RenderService;
  cursor: string;
}

async function findServiceByName(ownerId: string, name: string): Promise<RenderService | null> {
  const results = await renderRequest<RenderServiceListItem[]>(
    `/services?name=${encodeURIComponent(name)}&ownerId=${encodeURIComponent(ownerId)}&limit=1`
  );
  return results[0]?.service ?? null;
}

function buildCreateServiceBody(ownerId: string, params: ProviderDeployParams) {
  const base = {
    name: params.serviceName,
    ownerId,
    repo: params.repoUrl,
    branch: params.branch,
    autoDeploy: 'no' as const, // Mingo's own pipeline triggers every deploy explicitly (spec §11)
    rootDir: params.rootDirectory || '',
    envVars: params.envVars,
  };

  if (params.isStaticSite) {
    return {
      ...base,
      type: 'static_site' as const,
      serviceDetails: {
        buildCommand: params.buildCommand,
        publishPath: params.outputDirectory || 'dist',
      },
    };
  }

  return {
    ...base,
    type: 'web_service' as const,
    serviceDetails: {
      runtime: 'node' as const,
      // Free tier by default — never silently provisions a paid plan on the user's Render account.
      plan: 'free' as const,
      region: 'oregon' as const,
      healthCheckPath: params.healthCheckPath || '/',
      envSpecificDetails: {
        buildCommand: params.buildCommand,
        startCommand: params.startCommand || 'npm start',
      },
    },
  };
}

async function findOrCreateService(params: ProviderDeployParams): Promise<RenderService> {
  const ownerId = await resolveOwnerId();
  const existing = await findServiceByName(ownerId, params.serviceName);
  if (existing) return existing;

  return renderRequest<RenderService>('/services', {
    method: 'POST',
    body: JSON.stringify(buildCreateServiceBody(ownerId, params)),
  });
}

interface RenderDeploy {
  id: string;
  status: string;
  commit?: { id: string };
}

export const renderProvider: DeploymentProvider = {
  name: DeploymentOption.RENDER,

  isConfigured(): boolean {
    return Boolean(env.RENDER_API_KEY);
  },

  async deploy(params: ProviderDeployParams): Promise<ProviderDeployHandle> {
    const service = await findOrCreateService(params);

    // Existing service: env vars may have changed since the last deploy — replace them (Render's
    // bulk-replace semantics, per api-docs.render.com/reference/update-env-vars-for-service).
    if (params.envVars.length > 0) {
      await renderRequest(`/services/${service.id}/env-vars`, {
        method: 'PUT',
        body: JSON.stringify(params.envVars),
      });
    }

    const deploy = await renderRequest<RenderDeploy>(`/services/${service.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify(params.commitId ? { commitId: params.commitId } : {}),
    });

    return { providerServiceId: service.id, providerDeployId: deploy.id, commitId: deploy.commit?.id };
  },

  async getDeploymentStatus(handle: ProviderDeployHandle): Promise<ProviderDeployStatus> {
    const deploy = await renderRequest<RenderDeploy>(
      `/services/${handle.providerServiceId}/deploys/${handle.providerDeployId}`
    );
    return { phase: mapPhase(deploy.status), rawStatus: deploy.status, commitId: deploy.commit?.id };
  },

  async cancelDeployment(handle: ProviderDeployHandle): Promise<void> {
    await renderRequest(`/services/${handle.providerServiceId}/deploys/${handle.providerDeployId}/cancel`, {
      method: 'POST',
    });
  },

  async getLiveUrl(providerServiceId: string): Promise<string | undefined> {
    const service = await renderRequest<RenderService>(`/services/${providerServiceId}`);
    return service.serviceDetails?.url;
  },
};
