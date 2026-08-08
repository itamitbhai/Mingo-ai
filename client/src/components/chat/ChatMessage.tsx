'use client';

import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { MessageRole, MessageStatus, type IMessage } from 'shared';

import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageProps {
  message: IMessage;
  onRetry?: (messageId: string) => void;
}

export function ChatMessage({ message, onRetry }: ChatMessageProps) {
  const isUser = message.role === MessageRole.USER;
  const isPending = message.status === MessageStatus.PENDING || message.status === MessageStatus.STREAMING;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm sm:max-w-[70%]">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="gradient-bg flex size-8 shrink-0 items-center justify-center rounded-full">
        <Sparkles className="size-4 text-primary-foreground" />
      </div>
      <div className="min-w-0 max-w-[85%] flex-1 sm:max-w-[75%]">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card/60 px-4 py-2.5">
          {message.content ? (
            <MarkdownRenderer content={message.content} />
          ) : isPending ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Generating…
            </span>
          ) : null}

          {message.status === MessageStatus.STREAMING && message.content && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-text-bottom" />
          )}
        </div>

        {message.status === MessageStatus.FAILED && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-destructive">
              Something went wrong while generating this reply.
            </span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onRetry(message.id)}
              >
                <RotateCcw className="size-3" /> Retry
              </Button>
            )}
          </div>
        )}

        {message.status === MessageStatus.CANCELLED && (
          <p className="mt-1.5 text-xs text-muted-foreground">Generation stopped.</p>
        )}
      </div>
    </div>
  );
}
