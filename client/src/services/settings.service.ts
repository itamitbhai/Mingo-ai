import { cache } from 'react';
import type { ISettings, UpdateSettingsInput } from 'shared';

import { apiFetch } from '@/lib/api';

export const getSettings = cache((token: string | null) => {
  return apiFetch<ISettings>('/settings', { token });
});

export function updateSettings(data: UpdateSettingsInput, token: string | null) {
  return apiFetch<ISettings>('/settings', { method: 'PUT', body: data, token });
}
