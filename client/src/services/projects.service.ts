import { cache } from 'react';
import type { CreateProjectInput, IProject, PaginatedData, UpdateProjectInput } from 'shared';

import { apiFetch } from '@/lib/api';

export interface ListProjectsParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'name';
}

function toQueryString(params: ListProjectsParams): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function listProjects(params: ListProjectsParams, token: string | null) {
  return apiFetch<PaginatedData<IProject>>(`/projects${toQueryString(params)}`, { token });
}

export const getProject = cache((id: string, token: string | null) => {
  return apiFetch<IProject>(`/projects/${id}`, { token });
});

export function createProject(data: CreateProjectInput, token: string | null) {
  return apiFetch<IProject>('/projects', { method: 'POST', body: data, token });
}

export function updateProject(id: string, data: UpdateProjectInput, token: string | null) {
  return apiFetch<IProject>(`/projects/${id}`, { method: 'PUT', body: data, token });
}

export function deleteProject(id: string, token: string | null) {
  return apiFetch<null>(`/projects/${id}`, { method: 'DELETE', token });
}

export function archiveProject(id: string, token: string | null) {
  return apiFetch<IProject>(`/projects/${id}/archive`, { method: 'PATCH', token });
}

export function duplicateProject(id: string, token: string | null) {
  return apiFetch<IProject>(`/projects/${id}/duplicate`, { method: 'POST', token });
}
