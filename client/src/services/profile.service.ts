import { cache } from 'react';
import type { IUser, UpdateProfileInput } from 'shared';

import { apiFetch } from '@/lib/api';

export const getProfile = cache((token: string | null) => {
  return apiFetch<IUser>('/profile', { token });
});

export function updateProfile(data: UpdateProfileInput, token: string | null) {
  return apiFetch<IUser>('/profile', { method: 'PUT', body: data, token });
}

export function deleteAccount(token: string | null) {
  return apiFetch<null>('/profile', { method: 'DELETE', token });
}
