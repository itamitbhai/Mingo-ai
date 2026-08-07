import type { IActivity, IProject, PlanType } from 'shared';

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  totalDeployments: number;
  plan: PlanType;
  planLabel: string;
  projectLimit: number | null;
  usagePercentage: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  recentProjects: IProject[];
  recentActivity: IActivity[];
}
