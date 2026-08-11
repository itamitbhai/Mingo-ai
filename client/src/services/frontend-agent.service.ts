import type {
  ApplyGenerationInput,
  IAgentGeneration,
  IBatchOperationResult,
  ITaskBoardItem,
  RegenerateTaskInput,
  RejectGenerationInput,
} from 'shared';

import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type { FrontendAgentStreamEvent } from '@/types/frontend-agent';

export function listTasks(projectId: string, planId: string, token: string | null) {
  return apiFetch<ITaskBoardItem[]>(`/projects/${projectId}/plans/${planId}/tasks`, { token });
}

export function listGenerations(projectId: string, planId: string, taskId: string, token: string | null) {
  return apiFetch<IAgentGeneration[]>(
    `/projects/${projectId}/plans/${planId}/tasks/${taskId}/generations`,
    { token }
  );
}

export function getGeneration(
  projectId: string,
  planId: string,
  taskId: string,
  generationId: string,
  token: string | null
) {
  return apiFetch<IAgentGeneration>(
    `/projects/${projectId}/plans/${planId}/tasks/${taskId}/generations/${generationId}`,
    { token }
  );
}

export function applyGeneration(projectId: string, body: ApplyGenerationInput, token: string | null) {
  return apiFetch<IBatchOperationResult>(`/projects/${projectId}/workspace/ai/apply`, {
    method: 'POST',
    body,
    token,
  });
}

export function rejectGeneration(projectId: string, body: RejectGenerationInput, token: string | null) {
  return apiFetch<IAgentGeneration>(`/projects/${projectId}/workspace/ai/reject`, {
    method: 'POST',
    body,
    token,
  });
}

interface StreamHandlers {
  onEvent: (event: FrontendAgentStreamEvent) => void;
  signal: AbortSignal;
}

/** Streams Frontend Agent progress over the same SSE wire format the planner/chat endpoints use —
 *  `fetch` + `ReadableStream` rather than `EventSource`, since this needs a POST body and an
 *  Authorization header (see `planner.service.ts`'s `streamPlanRequest`). */
async function streamFrontendAgentRequest(
  path: string,
  body: RegenerateTaskInput | Record<string, never>,
  token: string | null,
  { onEvent, signal }: StreamHandlers
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
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
          onEvent(JSON.parse(raw) as FrontendAgentStreamEvent);
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

export function streamExecuteTask(
  projectId: string,
  planId: string,
  taskId: string,
  token: string | null,
  handlers: StreamHandlers
) {
  return streamFrontendAgentRequest(
    `/projects/${projectId}/plans/${planId}/tasks/${taskId}/execute`,
    {},
    token,
    handlers
  );
}

export function streamRegenerateTask(
  projectId: string,
  planId: string,
  taskId: string,
  body: RegenerateTaskInput,
  token: string | null,
  handlers: StreamHandlers
) {
  return streamFrontendAgentRequest(
    `/projects/${projectId}/plans/${planId}/tasks/${taskId}/regenerate`,
    body,
    token,
    handlers
  );
}
