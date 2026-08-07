import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { IProject } from 'shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/features/projects/project-status-badge';
import { formatRelativeTime } from '@/utils/format';
import { NewProjectButton } from './new-project-button';

export function RecentProjects({ projects }: { projects: IProject[] }) {
  return (
    <Card className="h-full bg-card/60">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent projects</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            View all <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t created any projects yet.
            </p>
            <NewProjectButton />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatRelativeTime(project.updatedAt)}
                    </p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
