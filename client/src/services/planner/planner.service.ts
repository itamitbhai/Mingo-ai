import type { GeneratePlanInput, IProjectPlan, RegeneratePlanInput, UpdatePlanInput } from 'shared';

import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type { PlannerStreamEvent } from '@/types/planner';

interface PlanPage {
  items: IProjectPlan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function listPlans(projectId: string, token: string | null, page = 1) {
  return apiFetch<PlanPage>(`/projects/${projectId}/plans?page=${page}`, { token });
}

export function getPlan(projectId: string, planId: string, token: string | null) {
  return apiFetch<IProjectPlan>(`/projects/${projectId}/plans/${planId}`, { token });
}

export function updatePlan(projectId: string, planId: string, data: UpdatePlanInput, token: string | null) {
  return apiFetch<IProjectPlan>(`/projects/${projectId}/plans/${planId}`, {
    method: 'PATCH',
    body: data,
    token,
  });
}

export function deletePlan(projectId: string, planId: string, token: string | null) {
  return apiFetch<null>(`/projects/${projectId}/plans/${planId}`, { method: 'DELETE', token });
}

interface StreamHandlers {
  onEvent: (event: PlannerStreamEvent) => void;
  signal: AbortSignal;
}

/**
 * Streams planner progress over the same SSE wire format the chat endpoint uses (see
 * `chat.service.ts`'s `streamMessage`) — `fetch` + `ReadableStream` rather than `EventSource`,
 * since this needs a POST body and an Authorization header.
 */
async function streamPlanRequest(
  path: string,
  body: GeneratePlanInput | RegeneratePlanInput,
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
          onEvent(JSON.parse(raw) as PlannerStreamEvent);
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

export function streamPlanGeneration(
  projectId: string,
  body: GeneratePlanInput,
  token: string | null,
  handlers: StreamHandlers
) {
  return streamPlanRequest(`/projects/${projectId}/plans`, body, token, handlers);
}

export function streamRegeneratePlan(
  projectId: string,
  planId: string,
  body: RegeneratePlanInput,
  token: string | null,
  handlers: StreamHandlers
) {
  return streamPlanRequest(`/projects/${projectId}/plans/${planId}/regenerate`, body, token, handlers);
}
