import { PlanType } from './enums';

export const PLAN_LIMITS: Record<PlanType, { projects: number; label: string }> = {
  [PlanType.FREE]: { projects: 3, label: 'Free' },
  [PlanType.PRO]: { projects: 50, label: 'Pro' },
  [PlanType.ENTERPRISE]: { projects: Infinity, label: 'Enterprise' },
};

export const DEFAULT_PAGE_SIZE = 9;

export const MAX_BATCH_OPERATIONS = 100;

export const API_ROUTES = {
  PROJECTS: '/api/projects',
  PROFILE: '/api/profile',
  SETTINGS: '/api/settings',
  ACTIVITY: '/api/activity',
  DASHBOARD: '/api/dashboard',
} as const;
