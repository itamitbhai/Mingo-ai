'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { FileCode2, Loader2, Plus, Sparkles, X } from 'lucide-react';

import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { EmptyChat } from '@/components/chat/EmptyChat';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/use-chat';
import { useConversations } from '@/hooks/use-conversations';
import * as chatService from '@/services/chat.service';
import * as conversationService from '@/services/conversation.service';
import type { MessagePage } from '@/types/chat';
import type { AIContextAttachment } from '@/types/workspace';

interface CurrentFile {
  path: string;
  language: string;
}

interface WorkspaceChatPanelProps {
  projectId: string;
  currentFile: CurrentFile | null;
  pendingAttachment: AIContextAttachment | null;
  onClearAttachment: () => void;
  onClose: () => void;
}

function buildContextPrefix(
  attachment: AIContextAttachment | null,
  currentFile: CurrentFile | null,
  attachCurrentFile: boolean
): string {
  if (attachment) {
    const code = attachment.selectedCode ?? '';
    return `Selected code from \`${attachment.filePath}\` (${attachment.language}):\n\`\`\`${attachment.language}\n${code}\n\`\`\`\n\n`;
  }

  if (attachCurrentFile && currentFile) {
    return `Current file: \`${currentFile.path}\` (${currentFile.language})\n\n`;
  }

  return '';
}

interface ConversationViewProps {
  conversationId: string;
  initialPage: MessagePage;
  initialMessage: string | null;
  currentFile: CurrentFile | null;
  pendingAttachment: AIContextAttachment | null;
  onClearAttachment: () => void;
  onFirstMessageSent: () => void;
}

function ConversationView({
  conversationId,
  initialPage,
  initialMessage,
  currentFile,
  pendingAttachment,
  onClearAttachment,
  onFirstMessageSent,
}: ConversationViewProps) {
  const chat = useChat({ conversationId, initialPage, onFirstMessageSent });
  const [attachCurrentFile, setAttachCurrentFile] = useState(false);
  const hasSentInitialMessage = useRef(false);

  function send(content: string) {
    const prefix = buildContextPrefix(pendingAttachment, currentFile, attachCurrentFile);
    chat.sendMessage(prefix ? `${prefix}${content}` : content);
    if (pendingAttachment) onClearAttachment();
  }

  useEffect(() => {
    if (hasSentInitialMessage.current || !initialMessage) return;
    hasSentInitialMessage.current = true;
    send(initialMessage);
    // Runs once for the message that created this conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  const showAttachmentBar = Boolean(pendingAttachment) || (attachCurrentFile && Boolean(currentFile));

  return (
    <>
      {showAttachmentBar && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs">
          <FileCode2 className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-muted-foreground">
            {pendingAttachment ? `Selection from ${pendingAttachment.filePath}` : currentFile?.path}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-5"
            aria-label="Remove attachment"
            onClick={() => (pendingAttachment ? onClearAttachment() : setAttachCurrentFile(false))}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
      <ChatMessages
        messages={chat.messages}
        hasMoreOlder={chat.hasMoreOlder}
        isLoadingOlder={chat.isLoadingOlder}
        onLoadOlder={chat.loadOlder}
        onRetry={chat.retryMessage}
      />
      {currentFile && !pendingAttachment && (
        <div className="px-2 pt-1.5">
          <button
            type="button"
            onClick={() => setAttachCurrentFile((value) => !value)}
            className={
              attachCurrentFile
                ? 'mb-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary'
                : 'mb-1 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground'
            }
          >
            <FileCode2 className="size-3" /> Attach current file
          </button>
        </div>
      )}
      <ChatComposer isStreaming={chat.isStreaming} onSend={send} onStop={chat.stopGeneration} />
    </>
  );
}

interface ConversationLoaderProps extends Omit<ConversationViewProps, 'initialPage'> {
  conversationId: string;
}

function ConversationLoader(props: ConversationLoaderProps) {
  const { getToken } = useAuth();
  const [initialPage, setInitialPage] = useState<MessagePage | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInitialPage(null);

    (async () => {
      const token = await getToken();
      const page = await chatService.listMessages(props.conversationId, { limit: 30 }, token);
      if (!cancelled) setInitialPage(page);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.conversationId]);

  if (!initialPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <ConversationView {...props} initialPage={initialPage} />;
}

export function WorkspaceChatPanel({
  projectId,
  currentFile,
  pendingAttachment,
  onClearAttachment,
  onClose,
}: WorkspaceChatPanelProps) {
  const { getToken } = useAuth();
  const conversations = useConversations(projectId, []);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const hasLoadedList = useRef(false);

  useEffect(() => {
    if (hasLoadedList.current) return;
    hasLoadedList.current = true;

    (async () => {
      const token = await getToken();
      const list = await conversationService.listConversations(projectId, token);
      list.forEach((conversation) => conversations.upsert(conversation));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewChat() {
    const conversation = await conversations.create();
    if (conversation) setActiveConversationId(conversation.id);
    return conversation;
  }

  async function handleFirstSend(content: string) {
    const conversation = await handleNewChat();
    if (conversation) setPendingMessage(content);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-4 text-primary" /> Mingo AI
        </div>
        <div className="flex items-center gap-1">
          {conversations.conversations.length > 0 && (
            <select
              aria-label="Conversation"
              className="max-w-28 truncate rounded-md border border-input bg-background/50 px-1.5 py-1 text-xs"
              value={activeConversationId ?? ''}
              onChange={(event) => setActiveConversationId(event.target.value || null)}
            >
              <option value="">Select chat</option>
              {conversations.conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" size="icon" className="size-7" onClick={handleNewChat} aria-label="New chat">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close AI chat">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {activeConversationId ? (
        <ConversationLoader
          conversationId={activeConversationId}
          initialMessage={pendingMessage}
          currentFile={currentFile}
          pendingAttachment={pendingAttachment}
          onClearAttachment={onClearAttachment}
          onFirstMessageSent={() => {
            setPendingMessage(null);
            void conversations.refresh(activeConversationId);
          }}
        />
      ) : (
        <div className="flex flex-1 flex-col">
          <EmptyChat onSelectPrompt={handleFirstSend} />
          <ChatComposer isStreaming={false} onSend={handleFirstSend} onStop={() => {}} />
        </div>
      )}
    </div>
  );
}
