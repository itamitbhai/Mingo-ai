import { API_URL, apiFetch, ApiError } from '@/lib/api';
import type { MessagePage, StreamEvent, StreamMessageBody } from '@/types/chat';

export function listMessages(
  conversationId: string,
  query: { cursor?: string; limit?: number },
  token: string | null
) {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  return apiFetch<MessagePage>(`/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`, {
    token,
  });
}

interface StreamMessageHandlers {
  onEvent: (event: StreamEvent) => void;
  signal: AbortSignal;
}

/**
 * Streams an AI reply over the wire-format the backend writes (SSE frames),
 * but via `fetch` rather than `EventSource` — `EventSource` can't send a POST
 * body or an Authorization header, and this app authenticates with a Clerk
 * bearer token rather than cookies.
 */
export async function streamMessage(
  conversationId: string,
  body: StreamMessageBody,
  token: string | null,
  { onEvent, signal }: StreamMessageHandlers
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
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
          onEvent(JSON.parse(raw) as StreamEvent);
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
