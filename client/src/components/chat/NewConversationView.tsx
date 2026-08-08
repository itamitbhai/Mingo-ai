'use client';

import { useState } from 'react';

import { ChatComposer } from './ChatComposer';
import { EmptyChat } from './EmptyChat';

interface NewConversationViewProps {
  onSend: (content: string) => void | Promise<void>;
}

export function NewConversationView({ onSend }: NewConversationViewProps) {
  const [isCreating, setIsCreating] = useState(false);

  async function handleSend(content: string) {
    setIsCreating(true);
    try {
      await onSend(content);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <EmptyChat onSelectPrompt={handleSend} disabled={isCreating} />
      <ChatComposer isStreaming={false} disabled={isCreating} onSend={handleSend} onStop={() => {}} />
    </>
  );
}
