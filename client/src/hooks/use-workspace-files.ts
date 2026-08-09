'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { IFileTreeNode } from 'shared';

import { ApiError } from '@/lib/api';
import * as fileService from '@/services/files/file.service';
import * as workspaceService from '@/services/workspace/workspace.service';
import { useWorkspaceUIStore } from '@/store/use-workspace-ui-store';

export function useWorkspaceFiles(projectId: string, initialTree: IFileTreeNode[]) {
  const { getToken } = useAuth();
  const [tree, setTree] = useState<IFileTreeNode[]>(initialTree);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const renamePath = useWorkspaceUIStore((state) => state.renamePath);
  const removePath = useWorkspaceUIStore((state) => state.removePath);

  async function refresh() {
    setIsRefreshing(true);
    try {
      const token = await getToken();
      const next = await fileService.getFileTree(projectId, token);
      setTree(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load files');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function createFile(path: string) {
    try {
      const token = await getToken();
      await fileService.createFile(projectId, { path }, token);
      toast.success('File created');
      await refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create file');
      return false;
    }
  }

  async function createFolder(path: string) {
    try {
      const token = await getToken();
      await fileService.createFolder(projectId, { path }, token);
      toast.success('Folder created');
      await refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create folder');
      return false;
    }
  }

  async function rename(path: string, newName: string) {
    try {
      const token = await getToken();
      const updated = await fileService.renameEntry(projectId, { path, newName }, token);
      renamePath(projectId, path, updated.path);
      toast.success('Renamed successfully');
      await refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to rename');
      return false;
    }
  }

  async function move(path: string, destinationPath: string) {
    try {
      const token = await getToken();
      await workspaceService.moveEntry(projectId, { path, destinationPath }, token);
      renamePath(projectId, path, destinationPath);
      toast.success('Moved successfully');
      await refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to move');
      return false;
    }
  }

  async function remove(path: string) {
    try {
      const token = await getToken();
      await fileService.deleteEntry(projectId, { path }, token);
      removePath(projectId, path);
      toast.success('Deleted successfully');
      await refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete');
      return false;
    }
  }

  return { tree, isRefreshing, refresh, createFile, createFolder, rename, move, remove };
}
