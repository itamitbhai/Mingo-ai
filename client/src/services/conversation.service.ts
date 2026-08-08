import { cache } from 'react';
import type { CreateConversationInput, IConversation, UpdateConversationInput } from 'shared';

import { apiFetch } from '@/lib/api';

export function listConversations(projectId: string, token: string | null) {
  return apiFetch<IConversation[]>(`/projects/${projectId}/conversations`, { token });
}

export function createConversation(
  projectId: string,
  data: CreateConversationInput,
  token: string | null
) {
  return apiFetch<IConversation>(`/projects/${projectId}/conversations`, {
    method: 'POST',
    body: data,
    token,
  });
}

export const getConversation = cache((id: string, token: string | null) => {
  return apiFetch<IConversation>(`/conversations/${id}`, { token });
});

export function renameConversation(id: string, data: UpdateConversationInput, token: string | null) {
  return apiFetch<IConversation>(`/conversations/${id}`, { method: 'PATCH', body: data, token });
}

export function deleteConversation(id: string, token: string | null) {
  return apiFetch<null>(`/conversations/${id}`, { method: 'DELETE', token });
}
