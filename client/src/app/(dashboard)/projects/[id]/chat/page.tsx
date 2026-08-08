import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { IProject } from 'shared';

import { ChatShell } from '@/components/chat/ChatShell';
import { ApiError } from '@/lib/api';
import { getServerAuthToken } from '@/lib/auth-server';
import { listConversations } from '@/services/conversation.service';
import { getProject } from '@/services/projects.service';

interface ChatIndexPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ChatIndexPageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await getServerAuthToken();

  try {
    const project = await getProject(id, token);
    return { title: `${project.name} · AI Chat` };
  } catch {
    return { title: 'AI Chat' };
  }
}

export default async function ChatIndexPage({ params }: ChatIndexPageProps) {
  const { id } = await params;
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

  const conversations = await listConversations(id, token);

  if (conversations.length > 0) {
    redirect(`/projects/${id}/chat/${conversations[0].id}`);
  }

  return (
    <ChatShell
      projectId={id}
      project={project}
      initialConversations={conversations}
      activeConversationId={null}
      initialMessagePage={null}
    />
  );
}
