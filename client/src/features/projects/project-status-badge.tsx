import { ProjectStatus } from 'shared';

import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: 'success' | 'secondary' | 'outline' }
> = {
  [ProjectStatus.ACTIVE]: { label: 'Active', variant: 'success' },
  [ProjectStatus.DRAFT]: { label: 'Draft', variant: 'secondary' },
  [ProjectStatus.ARCHIVED]: { label: 'Archived', variant: 'outline' },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
