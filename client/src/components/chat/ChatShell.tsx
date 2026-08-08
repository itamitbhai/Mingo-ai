'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IConversation, IProject } from 'shared';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useConversations } from '@/hooks/use-conversations';
import { useChatUIStore } from '@/store/use-chat-ui-store';
import type { MessagePage } from '@/types/chat';
import { ChatHeader } from './ChatHeader';
import { ChatSidebar } from './ChatSidebar';
import { ConversationView } from './ConversationView';
import { NewConversationView } from './NewConversationView';

interface ChatShellProps {
  projectId: string;
  project: Pick<
    IProject,
    'name' | 'frontend' | 'backend' | 'database' | 'authentication' | 'styling' | 'deployment'
  >;
  initialConversations: IConversation[];
  activeConversationId: string | null;
  initialMessagePage: MessagePage | null;
}

export function ChatShell({
  projectId,
  project,
  initialConversations,
  activeConversationId,
  initialMessagePage,
}: ChatShellProps) {
  const router = useRouter();
  const conversationsHook = useConversations(projectId, initialConversations);
  const isMobileSidebarOpen = useChatUIStore((state) => state.isMobileSidebarOpen);
  const openMobileSidebar = useChatUIStore((state) => state.openMobileSidebar);
  const closeMobileSidebar = useChatUIStore((state) => state.closeMobileSidebar);
  const setPendingFirstMessage = useChatUIStore((state) => state.setPendingFirstMessage);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setIsStreaming(false);
  }, [activeConversationId]);

  async function handleNewChat() {
    const conversation = await conversationsHook.create();
    if (conversation) {
      closeMobileSidebar();
      router.push(`/projects/${projectId}/chat/${conversation.id}`);
    }
  }

  async function handleCreateAndSend(content: string) {
    const conversation = await conversationsHook.create();
    if (!conversation) return;
    setPendingFirstMessage(conversation.id, content);
    router.push(`/projects/${projectId}/chat/${conversation.id}`);
  }

  function handleDelete(id: string) {
    conversationsHook.remove(
      id,
      activeConversationId === id ? { redirectTo: `/projects/${projectId}/chat` } : undefined
    );
  }

  const sidebar = (
    <ChatSidebar
      projectId={projectId}
      conversations={conversationsHook.conversations}
      activeConversationId={activeConversationId}
      pendingId={conversationsHook.pendingId}
      onNewChat={handleNewChat}
      onRename={conversationsHook.rename}
      onDelete={handleDelete}
    />
  );

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-140 overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="hidden w-72 shrink-0 border-r border-border md:flex md:flex-col">{sidebar}</div>

      <Sheet open={isMobileSidebarOpen} onOpenChange={(open) => (open ? openMobileSidebar() : closeMobileSidebar())}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          project={project}
          isStreaming={isStreaming}
          onNewChat={handleNewChat}
          onOpenSidebar={openMobileSidebar}
        />

        {activeConversationId && initialMessagePage ? (
          <ConversationView
            key={activeConversationId}
            conversationId={activeConversationId}
            initialPage={initialMessagePage}
            onFirstMessageSent={() => conversationsHook.refresh(activeConversationId)}
            onStreamingChange={setIsStreaming}
          />
        ) : (
          <NewConversationView onSend={handleCreateAndSend} />
        )}
      </div>
    </div>
  );
}
