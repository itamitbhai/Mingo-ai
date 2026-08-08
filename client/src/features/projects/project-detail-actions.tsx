'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Code2, Copy, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { useProjectActions } from '@/hooks/use-project-actions';
import { useEditProjectStore } from '@/store/use-edit-project-store';

export function ProjectDetailActions({ project }: { project: IProject }) {
  const { pendingId, archive, duplicate, remove } = useProjectActions();
  const editProject = useEditProjectStore((state) => state.open);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPending = pendingId === project.id;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/projects/${project.id}/workspace`}>
            <Code2 className="size-4" /> Open Workspace
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${project.id}/chat`}>
            <Sparkles className="size-4" /> Open AI Chat
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => editProject(project)} disabled={isPending}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => duplicate(project.id)}
          disabled={isPending}
        >
          <Copy className="size-4" /> Duplicate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => archive(project.id, project.status)}
          disabled={isPending}
        >
          {project.status === ProjectStatus.ARCHIVED ? (
            <>
              <ArchiveRestore className="size-4" /> Restore
            </>
          ) : (
            <>
              <Archive className="size-4" /> Archive
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          disabled={isPending}
          className="text-destructive hover:text-destructive"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete
        </Button>
      </div>

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
              onClick={() => remove(project.id, { redirectTo: '/projects' })}
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
