import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react';
import type { IProject } from 'shared';

import { Card, CardContent } from '@/components/ui/card';
import { ProjectDetailActions } from '@/features/projects/project-detail-actions';
import { ProjectStatusBadge } from '@/features/projects/project-status-badge';
import { ApiError } from '@/lib/api';
import { getServerAuthToken } from '@/lib/auth-server';
import { getProject } from '@/services/projects.service';
import { formatDate } from '@/utils/format';
import { getTechStackBadges } from '@/utils/tech-stack';

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

async function loadProject(id: string, token: string | null): Promise<IProject> {
  try {
    return await getProject(id, token);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: ProjectDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await getServerAuthToken();

  try {
    const project = await getProject(id, token);
    return { title: project.name };
  } catch {
    return { title: 'Project' };
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const token = await getServerAuthToken();
  const project = await loadProject(id, token);
  const badges = getTechStackBadges(project);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to projects
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="max-w-2xl text-muted-foreground">{project.description}</p>
        </div>
        <ProjectDetailActions project={project} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <Card key={badge.key} className="bg-card/60">
            <CardContent className="flex items-center gap-3">
              <div className="gradient-bg flex size-10 items-center justify-center rounded-lg">
                <badge.icon className="size-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground capitalize">{badge.key}</p>
                <p className="text-sm font-medium">{badge.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/60">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            Created {formatDate(project.createdAt)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Last updated {formatDate(project.updatedAt)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
