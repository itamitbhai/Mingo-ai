import type {
  BatchOperationsInput,
  CreateSnapshotInput,
  IBatchOperationResult,
  IOperationPreviewResult,
  IProjectFileVersion,
  IProjectFileVersionSummary,
  IProjectWorkspace,
  IWorkspaceActivity,
  IWorkspaceManifest,
  IWorkspaceSnapshot,
  MoveEntryInput,
} from 'shared';

import { apiFetch } from '@/lib/api';

interface CursorPage<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface PaginatedPage<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function getWorkspace(projectId: string, token: string | null) {
  return apiFetch<IProjectWorkspace>(`/projects/${projectId}/workspace`, { token });
}

export function getManifest(projectId: string, token: string | null) {
  return apiFetch<IWorkspaceManifest>(`/projects/${projectId}/workspace/manifest`, { token });
}

export function getActivity(projectId: string, token: string | null, cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch<CursorPage<IWorkspaceActivity>>(`/projects/${projectId}/workspace/activity${query}`, {
    token,
  });
}

export function listSnapshots(projectId: string, token: string | null, page = 1) {
  return apiFetch<PaginatedPage<IWorkspaceSnapshot>>(
    `/projects/${projectId}/workspace/snapshots?page=${page}`,
    { token }
  );
}

export function createSnapshot(projectId: string, data: CreateSnapshotInput, token: string | null) {
  return apiFetch<IWorkspaceSnapshot>(`/projects/${projectId}/workspace/snapshots`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function restoreSnapshot(projectId: string, snapshotId: string, token: string | null) {
  return apiFetch<{ snapshot: IWorkspaceSnapshot; backup: IWorkspaceSnapshot }>(
    `/projects/${projectId}/workspace/snapshots/${snapshotId}/restore`,
    { method: 'POST', token }
  );
}

export function previewOperations(projectId: string, data: BatchOperationsInput, token: string | null) {
  return apiFetch<IOperationPreviewResult>(`/projects/${projectId}/workspace/preview`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function applyBatch(projectId: string, data: BatchOperationsInput, token: string | null) {
  return apiFetch<IBatchOperationResult>(`/projects/${projectId}/workspace/batch`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function moveEntry(projectId: string, data: MoveEntryInput, token: string | null) {
  return apiFetch(`/projects/${projectId}/workspace/move`, { method: 'PATCH', body: data, token });
}

export function listVersions(
  projectId: string,
  path: string,
  token: string | null,
  cursor?: string | null
) {
  const params = new URLSearchParams({ path });
  if (cursor) params.set('cursor', cursor);
  return apiFetch<CursorPage<IProjectFileVersionSummary>>(
    `/projects/${projectId}/workspace/versions?${params.toString()}`,
    { token }
  );
}

export function getVersion(projectId: string, versionId: string, token: string | null) {
  return apiFetch<IProjectFileVersion>(`/projects/${projectId}/workspace/versions/${versionId}`, {
    token,
  });
}
