import type { CreateTestRunInput, IAgentGeneration, ITestFailureAnalysis, ITestRun, ITestRunScope } from 'shared';

import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type { TestRunStreamEvent } from '@/types/test-run';

export function listTestRuns(projectId: string, planId: string, taskId: string, token: string | null) {
  return apiFetch<ITestRun[]>(
    `/projects/${projectId}/test-runs?planId=${encodeURIComponent(planId)}&taskId=${encodeURIComponent(taskId)}`,
    { token }
  );
}

export function getTestRun(projectId: string, testRunId: string, token: string | null) {
  return apiFetch<ITestRun>(`/projects/${projectId}/test-runs/${testRunId}`, { token });
}

export function cancelTestRun(projectId: string, testRunId: string, token: string | null) {
  return apiFetch<{ cancelled: boolean }>(`/projects/${projectId}/test-runs/${testRunId}/cancel`, {
    method: 'POST',
    token,
  });
}

export function explainFailure(projectId: string, testRunId: string, resultIndex: number, token: string | null) {
  return apiFetch<ITestFailureAnalysis>(
    `/projects/${projectId}/test-runs/${testRunId}/results/${resultIndex}/explain`,
    { method: 'POST', token }
  );
}

export function generateFix(projectId: string, testRunId: string, resultIndex: number, token: string | null) {
  return apiFetch<IAgentGeneration>(`/projects/${projectId}/test-runs/${testRunId}/results/${resultIndex}/fix`, {
    method: 'POST',
    token,
  });
}

interface StreamHandlers {
  onEvent: (event: TestRunStreamEvent) => void;
  signal: AbortSignal;
}

/** Same fetch+ReadableStream SSE pattern as `frontend-agent.service.ts`'s
 *  `streamFrontendAgentRequest` — a POST body and Authorization header rule out `EventSource`. */
export async function streamCreateTestRun(
  projectId: string,
  planId: string,
  taskId: string,
  scope: ITestRunScope,
  token: string | null,
  { onEvent, signal }: StreamHandlers
): Promise<void> {
  const body: CreateTestRunInput = { planId, taskId, scope };
  let response: Response;

  try {
    response = await fetch(`${API_URL}/projects/${projectId}/test-runs`, {
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
          onEvent(JSON.parse(raw) as TestRunStreamEvent);
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
