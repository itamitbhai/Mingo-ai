import {
  CreditCard,
  LayoutDashboard,
  FolderKanban,
  LayoutTemplate,
  Rocket,
  Settings,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Templates', href: '/templates', icon: LayoutTemplate },
  { label: 'Deployments', href: '/deployments', icon: Rocket },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Profile', href: '/profile', icon: UserCircle },
];

export const MAX_PROJECT_NAME_LENGTH = 60;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 500;
