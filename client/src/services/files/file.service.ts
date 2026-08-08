import { cache } from 'react';
import type {
  CreateFileInput,
  CreateFolderInput,
  DeleteEntryInput,
  IFileTreeNode,
  IProjectFile,
  IProjectFileWithContent,
  RenameEntryInput,
  UpdateFileContentInput,
} from 'shared';

import { apiFetch } from '@/lib/api';
import type { FileSearchResult } from '@/types/workspace';

export function getFileTree(projectId: string, token: string | null) {
  return apiFetch<IFileTreeNode[]>(`/projects/${projectId}/files`, { token });
}

export const getFileContent = cache((projectId: string, path: string, token: string | null) => {
  return apiFetch<IProjectFileWithContent>(
    `/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`,
    { token }
  );
});

export function createFile(projectId: string, data: CreateFileInput, token: string | null) {
  return apiFetch<IProjectFile>(`/projects/${projectId}/files`, { method: 'POST', body: data, token });
}

export function createFolder(projectId: string, data: CreateFolderInput, token: string | null) {
  return apiFetch<IProjectFile>(`/projects/${projectId}/folders`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function updateFileContent(
  projectId: string,
  data: UpdateFileContentInput,
  token: string | null
) {
  return apiFetch<IProjectFile>(`/projects/${projectId}/files`, { method: 'PATCH', body: data, token });
}

export function renameEntry(projectId: string, data: RenameEntryInput, token: string | null) {
  return apiFetch<IProjectFile>(`/projects/${projectId}/files/rename`, {
    method: 'PATCH',
    body: data,
    token,
  });
}

export function deleteEntry(projectId: string, data: DeleteEntryInput, token: string | null) {
  return apiFetch<null>(`/projects/${projectId}/files`, { method: 'DELETE', body: data, token });
}

export function searchFiles(projectId: string, query: string, token: string | null) {
  return apiFetch<FileSearchResult[]>(
    `/projects/${projectId}/files/search?q=${encodeURIComponent(query)}`,
    { token }
  );
}
