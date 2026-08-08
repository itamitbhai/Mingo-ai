'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { MessageStatus, type IMessage } from 'shared';

import { ApiError } from '@/lib/api';
import * as chatService from '@/services/chat.service';
import type { MessagePage, StreamEvent } from '@/types/chat';

interface UseChatOptions {
  conversationId: string;
  initialPage: MessagePage;
  onFirstMessageSent?: () => void;
}

export function useChat({ conversationId, initialPage, onFirstMessageSent }: UseChatOptions) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<IMessage[]>(initialPage.items);
  const [hasMoreOlder, setHasMoreOlder] = useState(initialPage.hasMore);
  const [oldestCursor, setOldestCursor] = useState<string | null>(initialPage.nextCursor);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const upsertMessage = useCallback((message: IMessage) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === message.id);
      if (index === -1) return [...prev, message];
      const next = [...prev];
      next[index] = message;
      return next;
    });
  }, []);

  const appendDelta = useCallback((messageId: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: m.content + content, status: MessageStatus.STREAMING } : m
      )
    );
  }, []);

  const markFailed = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: MessageStatus.FAILED } : m))
    );
  }, []);

  const run = useCallback(
    async (body: { content?: string; retryMessageId?: string }) => {
      const wasEmpty = messages.length === 0;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      let currentAssistantId: string | null = null;

      try {
        const token = await getToken();

        await chatService.streamMessage(conversationId, body, token, {
          signal: controller.signal,
          onEvent: (event: StreamEvent) => {
            switch (event.type) {
              case 'user_message':
                upsertMessage(event.message);
                break;
              case 'assistant_start':
                currentAssistantId = event.message.id;
                upsertMessage(event.message);
                break;
              case 'delta':
                if (currentAssistantId) appendDelta(currentAssistantId, event.content);
                break;
              case 'done':
                upsertMessage(event.message);
                break;
              case 'error':
                toast.error(event.message);
                if (event.messageId) markFailed(event.messageId);
                break;
            }
          },
        });

        if (wasEmpty) {
          onFirstMessageSent?.();
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : 'Something went wrong while generating the response. Please try again.'
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, getToken, messages.length, onFirstMessageSent, upsertMessage, appendDelta, markFailed]
  );

  const sendMessage = useCallback((content: string) => run({ content }), [run]);
  const retryMessage = useCallback((messageId: string) => run({ retryMessageId: messageId }), [run]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const loadOlder = useCallback(async () => {
    if (!oldestCursor || isLoadingOlder) return;

    setIsLoadingOlder(true);
    try {
      const token = await getToken();
      const page = await chatService.listMessages(
        conversationId,
        { cursor: oldestCursor, limit: 30 },
        token
      );
      setMessages((prev) => [...page.items, ...prev]);
      setHasMoreOlder(page.hasMore);
      setOldestCursor(page.nextCursor);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load older messages');
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, getToken, oldestCursor, isLoadingOlder]);

  return {
    messages,
    isStreaming,
    hasMoreOlder,
    isLoadingOlder,
    sendMessage,
    retryMessage,
    stopGeneration,
    loadOlder,
  };
}
