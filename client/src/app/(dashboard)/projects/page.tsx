import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FolderKanban } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { NewProjectButton } from '@/features/dashboard/new-project-button';
import { ProjectCard } from '@/features/projects/project-card';
import { ProjectsToolbar } from '@/features/projects/projects-toolbar';
import { getServerAuthToken } from '@/lib/auth-server';
import { listProjects, type ListProjectsParams } from '@/services/projects.service';

export const metadata: Metadata = {
  title: 'Projects',
};

interface ProjectsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const token = await getServerAuthToken();

  const query: ListProjectsParams = {
    search: params.search,
    status: params.status,
    sort: (params.sort as ListProjectsParams['sort']) ?? 'newest',
    page: params.page ? Number(params.page) : 1,
  };

  const { items, pagination } = await listProjects(query, token);
  const hasFilters = Boolean(params.search || params.status);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Suspense fallback={<div className="h-10" />}>
        <ProjectsToolbar />
      </Suspense>

      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={hasFilters ? 'No projects match your filters' : 'No projects yet'}
          description={
            hasFilters
              ? 'Try adjusting your search term or status filter.'
              : 'Create your first project to start tracking it on Mingo AI.'
          }
          action={!hasFilters ? <NewProjectButton /> : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          <PaginationControls
            pagination={pagination}
            basePath="/projects"
            searchParams={{ search: params.search, status: params.status, sort: params.sort }}
            itemLabel="project"
          />
        </>
      )}
    </div>
  );
}
