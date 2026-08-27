import type { CreateSandboxRunInput, ISandboxSession } from 'shared';

import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type { SandboxStreamEvent } from '@/types/sandbox';

export function createSandboxRun(projectId: string, body: CreateSandboxRunInput, token: string | null) {
  return apiFetch<ISandboxSession>(`/projects/${projectId}/sandbox`, { method: 'POST', body, token });
}

export function listSandboxRuns(projectId: string, token: string | null) {
  return apiFetch<ISandboxSession[]>(`/projects/${projectId}/sandbox`, { token });
}

export function getSandboxRun(projectId: string, sandboxId: string, token: string | null) {
  return apiFetch<ISandboxSession>(`/projects/${projectId}/sandbox/${sandboxId}`, { token });
}

export function stopSandboxRun(projectId: string, sandboxId: string, token: string | null) {
  return apiFetch<ISandboxSession>(`/projects/${projectId}/sandbox/${sandboxId}/stop`, { method: 'POST', token });
}

interface StreamHandlers {
  onEvent: (event: SandboxStreamEvent) => void;
  signal: AbortSignal;
}

/** Same GET+fetch+ReadableStream SSE pattern as `workflow.service.ts`'s `streamWorkflowEvents` — a
 *  sandbox run may already be underway by the time this connects. */
export async function streamSandboxEvents(
  projectId: string,
  sandboxId: string,
  token: string | null,
  { onEvent, signal }: StreamHandlers
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/projects/${projectId}/sandbox/${sandboxId}/events`, {
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
    throw new ApiError(
      response.status,
      payload?.message ?? 'Something went wrong. Please try again.',
      payload?.errors
    );
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
          onEvent(JSON.parse(raw) as SandboxStreamEvent);
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
