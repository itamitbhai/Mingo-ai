import type { CreateWorkflowInput, IWorkflow } from 'shared';

import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type { WorkflowStreamEvent } from '@/types/workflow';

export function createWorkflow(projectId: string, body: CreateWorkflowInput, token: string | null) {
  return apiFetch<IWorkflow>(`/projects/${projectId}/workflows`, { method: 'POST', body, token });
}

export function listWorkflows(projectId: string, token: string | null) {
  return apiFetch<IWorkflow[]>(`/projects/${projectId}/workflows`, { token });
}

export function getWorkflow(projectId: string, workflowId: string, token: string | null) {
  return apiFetch<IWorkflow>(`/projects/${projectId}/workflows/${workflowId}`, { token });
}

export function pauseWorkflow(projectId: string, workflowId: string, token: string | null) {
  return apiFetch<IWorkflow>(`/projects/${projectId}/workflows/${workflowId}/pause`, { method: 'POST', token });
}

export function resumeWorkflow(projectId: string, workflowId: string, token: string | null) {
  return apiFetch<IWorkflow>(`/projects/${projectId}/workflows/${workflowId}/resume`, { method: 'POST', token });
}

export function cancelWorkflow(projectId: string, workflowId: string, token: string | null) {
  return apiFetch<IWorkflow>(`/projects/${projectId}/workflows/${workflowId}/cancel`, { method: 'POST', token });
}

export function retryWorkflowTask(projectId: string, workflowId: string, taskId: string, token: string | null) {
  return apiFetch<IWorkflow>(`/projects/${projectId}/workflows/${workflowId}/tasks/${taskId}/retry`, {
    method: 'POST',
    token,
  });
}

interface StreamHandlers {
  onEvent: (event: WorkflowStreamEvent) => void;
  signal: AbortSignal;
}

/**
 * Attaches to a workflow's live event stream (spec §19-21) — a GET, unlike every other stream helper
 * in this codebase (which are all POSTs that also kick the work off). The workflow may already be
 * running by the time this connects (started by `createWorkflow`, or by another tab); the server
 * replays its buffered event log first, then tails live ones. Still `fetch`+`ReadableStream`, not
 * `EventSource` — a GET with an Authorization header isn't expressible through the native
 * `EventSource` API.
 */
export async function streamWorkflowEvents(
  projectId: string,
  workflowId: string,
  token: string | null,
  { onEvent, signal }: StreamHandlers
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/projects/${projectId}/workflows/${workflowId}/events`, {
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
          onEvent(JSON.parse(raw) as WorkflowStreamEvent);
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
