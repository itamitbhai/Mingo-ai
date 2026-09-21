import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DeploymentShell } from '@/features/deployment/deployment-shell';
import { ApiError } from '@/lib/api';
import { getServerAuthToken } from '@/lib/auth-server';
import { getProject } from '@/services/projects.service';

interface DeployPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DeployPageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await getServerAuthToken();

  try {
    const project = await getProject(id, token);
    return { title: `Deploy · ${project.name}` };
  } catch {
    return { title: 'Deploy' };
  }
}

export default async function DeployPage({ params }: DeployPageProps) {
  const { id } = await params;
  const token = await getServerAuthToken();

  let projectName: string;
  try {
    const project = await getProject(id, token);
    projectName = project.name;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="size-4" /> Back to {projectName}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Deploy</h1>
        <p className="text-sm text-muted-foreground">
          Configure and deploy &quot;{projectName}&quot; to a real hosting provider.
        </p>
      </div>

      <DeploymentShell projectId={id} />
    </div>
  );
}
