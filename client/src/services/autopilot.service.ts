import type { GeneratePlanInput } from 'shared';

import { API_URL, ApiError } from '@/lib/api';
import type { AutopilotStreamEvent } from '@/types/autopilot';

interface StreamHandlers {
  onEvent: (event: AutopilotStreamEvent) => void;
  signal: AbortSignal;
}

/**
 * Streams an Autopilot run over the same SSE wire format as `planner.service.ts`'s
 * `streamPlanRequest` / `frontend-agent.service.ts`'s stream reader — `fetch` + `ReadableStream`
 * rather than `EventSource`, since this needs a POST body and an Authorization header. Kept as its
 * own copy rather than a shared util, matching how those two services each keep their own.
 */
async function streamAutopilotRequest(
  path: string,
  body: GeneratePlanInput,
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
          onEvent(JSON.parse(raw) as AutopilotStreamEvent);
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

export function streamAutopilot(
  projectId: string,
  body: GeneratePlanInput,
  token: string | null,
  handlers: StreamHandlers
) {
  return streamAutopilotRequest(`/projects/${projectId}/autopilot`, body, token, handlers);
}
