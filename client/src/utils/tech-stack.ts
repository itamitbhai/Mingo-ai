import {
  Code2,
  Database,
  Palette,
  Rocket,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  AuthOption,
  BackendStack,
  DatabaseOption,
  DeploymentOption,
  FrontendStack,
  StylingOption,
  type IProject,
} from 'shared';

export const FRONTEND_OPTIONS = Object.values(FrontendStack);
export const BACKEND_OPTIONS = Object.values(BackendStack);
export const DATABASE_OPTIONS = Object.values(DatabaseOption);
export const AUTH_OPTIONS = Object.values(AuthOption);
export const STYLING_OPTIONS = Object.values(StylingOption);
export const DEPLOYMENT_OPTIONS = Object.values(DeploymentOption);

export interface TechStackBadge {
  key: string;
  label: string;
  icon: LucideIcon;
}

export function getTechStackBadges(
  project: Pick<IProject, 'frontend' | 'backend' | 'database' | 'authentication' | 'styling' | 'deployment'>
): TechStackBadge[] {
  return [
    { key: 'frontend', label: project.frontend, icon: Code2 },
    { key: 'backend', label: project.backend, icon: Server },
    { key: 'database', label: project.database, icon: Database },
    { key: 'authentication', label: project.authentication, icon: ShieldCheck },
    { key: 'styling', label: project.styling, icon: Palette },
    { key: 'deployment', label: project.deployment, icon: Rocket },
  ];
}
