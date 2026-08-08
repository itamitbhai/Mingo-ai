'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { MESSAGE_MAX_LENGTH } from 'shared';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatComposerProps {
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function ChatComposer({ isStreaming, disabled, onSend, onStop }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MESSAGE_MAX_LENGTH || isStreaming || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const isOverLimit = value.length > MESSAGE_MAX_LENGTH;

  return (
    <div className="border-t border-border bg-background/80 p-3 backdrop-blur sm:p-4">
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-background/50 p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Mingo AI anything about this project…"
          rows={1}
          disabled={disabled}
          aria-label="Message"
          className="max-h-[200px] min-h-10 resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={disabled || !value.trim() || isOverLimit}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>Enter to send · Shift+Enter for a new line</span>
        {value.length > MESSAGE_MAX_LENGTH * 0.8 && (
          <span className={cn(isOverLimit && 'text-destructive')}>
            {value.length}/{MESSAGE_MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
