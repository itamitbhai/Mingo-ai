import {
  Archive,
  Building2,
  Copy,
  FolderPlus,
  Pencil,
  Rocket,
  Trash2,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from 'shared';

export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  [ActivityType.PROJECT_CREATED]: FolderPlus,
  [ActivityType.PROJECT_UPDATED]: Pencil,
  [ActivityType.PROJECT_DELETED]: Trash2,
  [ActivityType.PROJECT_ARCHIVED]: Archive,
  [ActivityType.PROJECT_DUPLICATED]: Copy,
  [ActivityType.DEPLOYMENT_TRIGGERED]: Rocket,
  [ActivityType.PROFILE_UPDATED]: UserCog,
  [ActivityType.WORKSPACE_CREATED]: Building2,
};
