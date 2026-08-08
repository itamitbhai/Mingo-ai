import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MessageStatus } from 'shared';
import type { StreamEvent } from '@/types/chat';
import { useChat } from './use-chat';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const streamMessageMock = vi.fn();
vi.mock('@/services/chat.service', () => ({
  streamMessage: (...args: unknown[]) => streamMessageMock(...args),
  listMessages: vi.fn(),
}));

type StreamHandlers = { onEvent: (event: StreamEvent) => void; signal: AbortSignal };

describe('useChat', () => {
  it('applies streamed deltas to the assistant message and resolves isStreaming to false', async () => {
    streamMessageMock.mockImplementation(
      async (_conversationId: string, _body: unknown, _token: string | null, { onEvent }: StreamHandlers) => {
        onEvent({
          type: 'assistant_start',
          message: { id: 'a1', role: 'assistant', content: '', status: 'pending' },
        } as StreamEvent);
        onEvent({ type: 'delta', content: 'Hello' });
        onEvent({ type: 'delta', content: ' world' });
        onEvent({
          type: 'done',
          message: { id: 'a1', role: 'assistant', content: 'Hello world', status: 'completed' },
        } as StreamEvent);
      }
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: 'c1', initialPage: { items: [], hasMore: false, nextCursor: null } })
    );

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello world');
    expect(result.current.messages[0].status).toBe('completed');
  });

  it('marks the message as failed when the stream reports an error', async () => {
    streamMessageMock.mockImplementation(
      async (_conversationId: string, _body: unknown, _token: string | null, { onEvent }: StreamHandlers) => {
        onEvent({
          type: 'assistant_start',
          message: { id: 'a1', role: 'assistant', content: '', status: 'pending' },
        } as StreamEvent);
        onEvent({ type: 'error', message: 'boom', messageId: 'a1' });
      }
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: 'c2', initialPage: { items: [], hasMore: false, nextCursor: null } })
    );

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    await waitFor(() => expect(result.current.messages[0].status).toBe(MessageStatus.FAILED));
  });

  it('stopGeneration aborts the in-flight stream', async () => {
    let capturedSignal: AbortSignal | undefined;
    streamMessageMock.mockImplementation(
      async (_conversationId: string, _body: unknown, _token: string | null, { signal }: StreamHandlers) => {
        capturedSignal = signal;
        // Mirrors real fetch/abort behavior: never resolves on its own, only rejects on abort.
        await new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
    );

    const { result } = renderHook(() =>
      useChat({ conversationId: 'c3', initialPage: { items: [], hasMore: false, nextCursor: null } })
    );

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage('Hi');
    });

    await waitFor(() => expect(capturedSignal).toBeDefined());
    act(() => {
      result.current.stopGeneration();
    });

    await act(async () => {
      await sendPromise;
    });

    expect(capturedSignal?.aborted).toBe(true);
  });
});
