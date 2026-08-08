'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Copy, Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { ProjectStatus, type IProject } from 'shared';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useProjectActions } from '@/hooks/use-project-actions';
import { useEditProjectStore } from '@/store/use-edit-project-store';
import { formatRelativeTime, truncate } from '@/utils/format';
import { getTechStackBadges } from '@/utils/tech-stack';
import { ProjectStatusBadge } from './project-status-badge';

export function ProjectCard({ project }: { project: IProject }) {
  const { pendingId, archive, duplicate, remove } = useProjectActions();
  const editProject = useEditProjectStore((state) => state.open);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPending = pendingId === project.id;
  const badges = getTechStackBadges(project).slice(0, 3);

  return (
    <>
      <Card className="group relative h-full bg-card/60 transition-colors hover:border-primary/40">
        {/* Makes the whole card tappable/clickable, not just the title text — the interactive
            bits below (dropdown trigger) sit in a `pointer-events-auto` island above this. */}
        <Link
          href={`/projects/${project.id}`}
          className="absolute inset-0 z-0 rounded-[inherit]"
          aria-label={`Open ${project.name}`}
        />

        <div className="pointer-events-none relative z-1 flex h-full flex-col gap-6">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <h3 className="min-w-0 flex-1 truncate font-semibold group-hover:text-primary">
              {project.name}
            </h3>
            <div className="pointer-events-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Project actions"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MoreVertical className="size-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => editProject(project)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicate(project.id)}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => archive(project.id, project.status)}>
                    {project.status === ProjectStatus.ARCHIVED ? (
                      <>
                        <ArchiveRestore /> Restore
                      </>
                    ) : (
                      <>
                        <Archive /> Archive
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">{truncate(project.description, 110)}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  <badge.icon className="size-3" />
                  {badge.label}
                </span>
              ))}
            </div>
          </CardContent>

          <CardFooter className="justify-between">
            <ProjectStatusBadge status={project.status} />
            <span className="text-xs text-muted-foreground">
              Updated {formatRelativeTime(project.updatedAt)}
            </span>
          </CardFooter>
        </div>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{project.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and its deployment history. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove(project.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
