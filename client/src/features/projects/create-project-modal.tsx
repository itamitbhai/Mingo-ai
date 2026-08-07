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
import { createProject } from '@/services/projects.service';
import { useCreateProjectStore } from '@/store/use-create-project-store';
import {
  AUTH_OPTIONS,
  BACKEND_OPTIONS,
  DATABASE_OPTIONS,
  DEPLOYMENT_OPTIONS,
  FRONTEND_OPTIONS,
  STYLING_OPTIONS,
} from '@/utils/tech-stack';
import { ProjectForm } from './project-form';

const DEFAULT_VALUES: CreateProjectInput = {
  name: '',
  description: '',
  frontend: FRONTEND_OPTIONS[1],
  backend: BACKEND_OPTIONS[0],
  database: DATABASE_OPTIONS[0],
  authentication: AUTH_OPTIONS[1],
  styling: STYLING_OPTIONS[1],
  deployment: DEPLOYMENT_OPTIONS[0],
};

export function CreateProjectModal() {
  const { isOpen, prefill, close } = useCreateProjectStore();
  const { getToken } = useAuth();
  const router = useRouter();

  const handleSubmit = async (data: CreateProjectInput) => {
    try {
      const token = await getToken();
      const project = await createProject(data, token);
      toast.success(`"${project.name}" was created`);
      close();
      router.refresh();
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create project');
      throw error;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Describe your project and pick the stack you&apos;re building with.
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <ProjectForm
            defaultValues={{ ...DEFAULT_VALUES, ...prefill }}
            onSubmit={handleSubmit}
            onCancel={close}
            submitLabel="Create project"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
