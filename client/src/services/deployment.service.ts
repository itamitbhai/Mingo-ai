import type {
  CreateDeploymentInput,
  CreateEnvironmentVariableInput,
  DeploymentConfigInput,
  DeploymentEnvironment,
  UpdateEnvironmentVariableInput,
} from 'shared';

import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type {
  IDeployment,
  IDeploymentConfig,
  IDeploymentReadiness,
  IDeploymentStreamEvent,
  IEnvironmentVariable,
  IRevealedEnvironmentVariable,
} from '@/types/deployment';

export function getDeploymentConfig(
  token: string | null,
  projectId: string,
  environment: DeploymentEnvironment
) {
  return apiFetch<IDeploymentConfig | null>(
    `/projects/${projectId}/deployment/config?environment=${environment}`,
    { token }
  );
}

export function listDeploymentConfigs(token: string | null, projectId: string) {
  return apiFetch<IDeploymentConfig[]>(`/projects/${projectId}/deployment/configs`, { token });
}

export function saveDeploymentConfig(token: string | null, projectId: string, data: DeploymentConfigInput) {
  return apiFetch<IDeploymentConfig>(`/projects/${projectId}/deployment/config`, {
    method: 'PUT',
    body: data,
    token,
  });
}

export function listEnvironmentVariables(
  token: string | null,
  projectId: string,
  environment?: DeploymentEnvironment
) {
  const qs = environment ? `?environment=${environment}` : '';
  return apiFetch<IEnvironmentVariable[]>(`/projects/${projectId}/environment-variables${qs}`, { token });
}

export function revealEnvironmentVariable(token: string | null, projectId: string, id: string) {
  return apiFetch<IRevealedEnvironmentVariable>(`/projects/${projectId}/environment-variables/${id}/reveal`, {
    token,
  });
}

export function createEnvironmentVariable(
  token: string | null,
  projectId: string,
  data: CreateEnvironmentVariableInput
) {
  return apiFetch<IEnvironmentVariable>(`/projects/${projectId}/environment-variables`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function updateEnvironmentVariable(
  token: string | null,
  projectId: string,
  id: string,
  data: UpdateEnvironmentVariableInput
) {
  return apiFetch<IEnvironmentVariable>(`/projects/${projectId}/environment-variables/${id}`, {
    method: 'PATCH',
    body: data,
    token,
  });
}

export function deleteEnvironmentVariable(token: string | null, projectId: string, id: string) {
  return apiFetch<{ deleted: boolean }>(`/projects/${projectId}/environment-variables/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function validateDeployment(token: string | null, projectId: string, data: CreateDeploymentInput) {
  return apiFetch<IDeploymentReadiness>(`/projects/${projectId}/deployment/validate`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function createDeployment(token: string | null, projectId: string, data: CreateDeploymentInput) {
  return apiFetch<IDeployment>(`/projects/${projectId}/deployment/deploy`, { method: 'POST', body: data, token });
}

export function listDeploymentHistory(
  token: string | null,
  projectId: string,
  params: { environment?: DeploymentEnvironment; page?: number; limit?: number } = {}
) {
  const query = new URLSearchParams();
  if (params.environment) query.set('environment', params.environment);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  return apiFetch<{ items: IDeployment[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
    `/projects/${projectId}/deployment/history${qs ? `?${qs}` : ''}`,
    { token }
  );
}

export function getDeployment(token: string | null, projectId: string, deploymentId: string) {
  return apiFetch<IDeployment>(`/projects/${projectId}/deployment/${deploymentId}`, { token });
}

export function cancelDeployment(token: string | null, projectId: string, deploymentId: string) {
  return apiFetch<IDeployment>(`/projects/${projectId}/deployment/${deploymentId}/cancel`, {
    method: 'POST',
    token,
  });
}

export function rollbackDeployment(token: string | null, projectId: string, deploymentId: string) {
  return apiFetch<IDeployment>(`/projects/${projectId}/deployment/${deploymentId}/rollback`, {
    method: 'POST',
    token,
  });
}

interface DeploymentStreamHandlers {
  onEvent: (event: IDeploymentStreamEvent) => void;
  signal: AbortSignal;
}

/** Same GET+fetch+ReadableStream SSE pattern as `sandbox.service.ts`'s `streamSandboxEvents` — native
 *  `EventSource` can't carry the `Authorization` header this API needs. */
export async function streamDeploymentEvents(
  projectId: string,
  deploymentId: string,
  token: string | null,
  { onEvent, signal }: DeploymentStreamHandlers
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/projects/${projectId}/deployment/${deploymentId}/events`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw new ApiError(0, 'Unable to reach the Mingo AI API. Please check your connection.');
  }

  if (!response.ok || !response.body) {
    const contentType = response.headers.get('content-type');
    const payload = contentType?.includes('application/json') ? await response.json() : null;
    throw new ApiError(response.status, payload?.message ?? 'Something went wrong. Please try again.', payload?.errors);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;

        const raw = dataLine.slice(5).trim();
        if (!raw) continue;

        try {
          onEvent(JSON.parse(raw) as IDeploymentStreamEvent);
        } catch {
          // Ignore a malformed frame rather than aborting the whole stream.
        }
      }
    }
  } catch (err) {
    if (signal.aborted) return;
    throw err;
  }
}
