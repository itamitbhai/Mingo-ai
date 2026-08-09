import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { PlannerWorkspace } from '@/components/planner/PlannerWorkspace';
import { ApiError } from '@/lib/api';
import { getServerAuthToken } from '@/lib/auth-server';
import { getProject } from '@/services/projects.service';

interface PlannerPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PlannerPageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await getServerAuthToken();

  try {
    const project = await getProject(id, token);
    return { title: `${project.name} · Planner` };
  } catch {
    return { title: 'Planner' };
  }
}

export default async function PlannerPage({ params }: PlannerPageProps) {
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/projects/${id}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to project
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Mingo AI Planner</h1>
        </div>
        <p className="text-muted-foreground">
          Turn a natural-language request into a structured plan for &ldquo;{projectName}&rdquo; —
          requirements, stack, architecture, and a task graph. This does not write code or modify
          your project.
        </p>
      </div>

      <PlannerWorkspace projectId={id} />
    </div>
  );
}
