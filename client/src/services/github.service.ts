import type { CreateGitBranchInput, CreateGithubRepoInput } from 'shared';

import { apiFetch } from '@/lib/api';
import type { IGitHubBranch, IGitHubRepository, IGitHubRepositoryList, IGitHubStatus } from '@/types/github';

export function getGithubAuthorizeUrl(token: string | null) {
  return apiFetch<{ authorizeUrl: string }>('/github/connect', { token });
}

export function getGithubStatus(token: string | null) {
  return apiFetch<IGitHubStatus>('/github/status', { token });
}

export function disconnectGithub(token: string | null) {
  return apiFetch<{ disconnected: boolean }>('/github/disconnect', { method: 'POST', token });
}

export function listGithubRepositories(
  token: string | null,
  params: { search?: string; page?: number; limit?: number } = {}
) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  return apiFetch<IGitHubRepositoryList>(`/github/repositories${qs ? `?${qs}` : ''}`, { token });
}

export function getGithubRepository(token: string | null, fullName: string) {
  return apiFetch<IGitHubRepository>(`/github/repositories/${encodeURIComponent(fullName)}`, { token });
}

export function listGithubBranches(token: string | null, fullName: string) {
  return apiFetch<IGitHubBranch[]>(`/github/repositories/${encodeURIComponent(fullName)}/branches`, { token });
}

export function createGithubBranch(token: string | null, fullName: string, data: CreateGitBranchInput) {
  return apiFetch<IGitHubBranch>(`/github/repositories/${encodeURIComponent(fullName)}/branches`, {
    method: 'POST',
    body: data,
    token,
  });
}

export function createGithubRepository(token: string | null, data: CreateGithubRepoInput) {
  return apiFetch<IGitHubRepository>('/github/repositories', { method: 'POST', body: data, token });
}
