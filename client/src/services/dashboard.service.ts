import { cache } from 'react';

import { apiFetch } from '@/lib/api';
import type { DashboardOverview } from '@/types/dashboard';

export const getDashboardOverview = cache((token: string | null) => {
  return apiFetch<DashboardOverview>('/dashboard/overview', { token });
});
