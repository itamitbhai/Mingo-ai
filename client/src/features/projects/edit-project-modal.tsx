'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { CreateProjectInput } from 'shared';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { updateProject } from '@/services/projects.service';
import { useEditProjectStore } from '@/store/use-edit-project-store';
import { ProjectForm } from './project-form';

export function EditProjectModal() {
  const { project, close } = useEditProjectStore();
  const { getToken } = useAuth();
  const router = useRouter();

  const handleSubmit = async (data: CreateProjectInput) => {
    if (!project) return;

    try {
      const token = await getToken();
      await updateProject(project.id, data, token);
      toast.success('Project updated');
      close();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update project');
      throw error;
    }
  };

  return (
    <Dialog open={!!project} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update your project&apos;s details and tech stack.</DialogDescription>
        </DialogHeader>

        {project && (
          <ProjectForm
            defaultValues={{
              name: project.name,
              description: project.description,
              frontend: project.frontend,
              backend: project.backend,
              database: project.database,
              authentication: project.authentication,
              styling: project.styling,
              deployment: project.deployment,
            }}
            onSubmit={handleSubmit}
            onCancel={close}
            submitLabel="Save changes"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
