import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { IProject } from 'shared';

import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import { ApiError } from '@/lib/api';
import { getServerAuthToken } from '@/lib/auth-server';
import { getFileTree } from '@/services/files/file.service';
import { getProject } from '@/services/projects.service';

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: WorkspacePageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await getServerAuthToken();

  try {
    const project = await getProject(id, token);
    return { title: `${project.name} · Workspace` };
  } catch {
    return { title: 'Workspace' };
  }
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
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

  const tree = await getFileTree(id, token);

  return <WorkspaceShell projectId={id} project={project} initialTree={tree} />;
}
