import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { IProject } from 'shared';

import { ChatShell } from '@/components/chat/ChatShell';
import { ApiError } from '@/lib/api';
import { getServerAuthToken } from '@/lib/auth-server';
import { listMessages } from '@/services/chat.service';
import { listConversations } from '@/services/conversation.service';
import { getProject } from '@/services/projects.service';

interface ChatConversationPageProps {
  params: Promise<{ id: string; conversationId: string }>;
}

export async function generateMetadata({ params }: ChatConversationPageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await getServerAuthToken();

  try {
    const project = await getProject(id, token);
    return { title: `${project.name} · AI Chat` };
  } catch {
    return { title: 'AI Chat' };
  }
}

export default async function ChatConversationPage({ params }: ChatConversationPageProps) {
  const { id, conversationId } = await params;
  const token = await getServerAuthToken();

  let project: IProject;

  try {
    project = await getProject(id, token);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  let conversations;
  let messagePage;

  try {
    [conversations, messagePage] = await Promise.all([
      listConversations(id, token),
      listMessages(conversationId, { limit: 30 }, token),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  return (
    <ChatShell
      projectId={id}
      project={project}
      initialConversations={conversations}
      activeConversationId={conversationId}
      initialMessagePage={messagePage}
    />
  );
}
