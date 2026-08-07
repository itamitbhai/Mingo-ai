'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ProjectStatus } from 'shared';

import { ApiError } from '@/lib/api';
import * as projectsService from '@/services/projects.service';

export function useProjectActions() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function archive(id: string, currentStatus: ProjectStatus) {
    setPendingId(id);
    try {
      const token = await getToken();
      await projectsService.archiveProject(id, token);
      toast.success(
        currentStatus === ProjectStatus.ARCHIVED ? 'Project restored' : 'Project archived'
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    } finally {
      setPendingId(null);
    }
  }

  async function duplicate(id: string) {
    setPendingId(id);
    try {
      const token = await getToken();
      const copy = await projectsService.duplicateProject(id, token);
      toast.success(`"${copy.name}" created`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string, options?: { redirectTo?: string }) {
    setPendingId(id);
    try {
      const token = await getToken();
      await projectsService.deleteProject(id, token);
      toast.success('Project deleted');
      if (options?.redirectTo) {
        router.push(options.redirectTo);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete project');
    } finally {
      setPendingId(null);
    }
  }

  return { pendingId, archive, duplicate, remove };
}
