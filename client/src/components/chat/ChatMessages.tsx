'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import type { IMessage } from 'shared';

import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';

interface ChatMessagesProps {
  messages: IMessage[];
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (messageId: string) => void;
}

export function ChatMessages({
  messages,
  hasMoreOlder,
  isLoadingOlder,
  onLoadOlder,
  onRetry,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  const previousMessageCount = useRef(messages.length);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;

    if (el.scrollTop < 80 && hasMoreOlder && !isLoadingOlder) {
      onLoadOlder();
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distanceFromBottom < 120;
    setIsPinnedToBottom(pinned);
    if (pinned) setShowNewMessagesPill(false);
  }

  useEffect(() => {
    const grew = messages.length !== previousMessageCount.current;
    previousMessageCount.current = messages.length;

    const el = containerRef.current;
    if (!el) return;

    if (isPinnedToBottom) {
      el.scrollTop = el.scrollHeight;
    } else if (grew) {
      setShowNewMessagesPill(true);
    }
  }, [messages, isPinnedToBottom]);

  function scrollToBottom() {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setShowNewMessagesPill(false);
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full space-y-4 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {isLoadingOlder && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} onRetry={onRetry} />
        ))}
      </div>

      {showNewMessagesPill && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            className="pointer-events-auto shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown className="size-3.5" /> New messages
          </Button>
        </div>
      )}
    </div>
  );
}
