'use client';

import { useEffect, useRef } from 'react';

import { useChat } from '@/hooks/use-chat';
import { useChatUIStore } from '@/store/use-chat-ui-store';
import type { MessagePage } from '@/types/chat';
import { ChatComposer } from './ChatComposer';
import { ChatMessages } from './ChatMessages';

interface ConversationViewProps {
  conversationId: string;
  initialPage: MessagePage;
  onFirstMessageSent?: () => void;
  onStreamingChange?: (isStreaming: boolean) => void;
}

export function ConversationView({
  conversationId,
  initialPage,
  onFirstMessageSent,
  onStreamingChange,
}: ConversationViewProps) {
  const consumePendingFirstMessage = useChatUIStore((state) => state.consumePendingFirstMessage);
  const chat = useChat({ conversationId, initialPage, onFirstMessageSent });
  const hasConsumedPending = useRef(false);

  useEffect(() => {
    if (hasConsumedPending.current) return;
    hasConsumedPending.current = true;

    const pending = consumePendingFirstMessage(conversationId);
    if (pending) {
      chat.sendMessage(pending);
    }
    // Intentionally runs once per mounted conversation — not on every `chat` identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    onStreamingChange?.(chat.isStreaming);
  }, [chat.isStreaming, onStreamingChange]);

  return (
    <>
      <ChatMessages
        messages={chat.messages}
        hasMoreOlder={chat.hasMoreOlder}
        isLoadingOlder={chat.isLoadingOlder}
        onLoadOlder={chat.loadOlder}
        onRetry={chat.retryMessage}
      />
      <ChatComposer isStreaming={chat.isStreaming} onSend={chat.sendMessage} onStop={chat.stopGeneration} />
    </>
  );
}
