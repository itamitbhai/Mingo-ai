'use client';

import { AlertTriangle, Check, History, Loader2, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { WorkspaceUiStatus } from '@/store/use-workspace-store';

const STATUS_CONFIG: Record<
  WorkspaceUiStatus,
  { label: string; icon: React.ComponentType<{ className?: string }> | null; className: string }
> = {
  ready: { label: 'Workspace Ready', icon: Check, className: 'text-muted-foreground' },
  saving: { label: 'Saving', icon: Loader2, className: 'text-muted-foreground' },
  unsaved: { label: 'Unsaved Changes', icon: null, className: 'text-amber-500' },
  conflict: { label: 'Conflict — reload', icon: AlertTriangle, className: 'text-destructive' },
  error: { label: 'Save failed', icon: AlertTriangle, className: 'text-destructive' },
  restoring: { label: 'Restoring…', icon: RotateCcw, className: 'text-muted-foreground' },
  snapshotting: { label: 'Snapshotting…', icon: History, className: 'text-muted-foreground' },
};

interface WorkspaceStatusBadgeProps {
  status: WorkspaceUiStatus;
  dirtyCount?: number;
}

export function WorkspaceStatusBadge({ status, dirtyCount = 0 }: WorkspaceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const label = status === 'unsaved' && dirtyCount > 1 ? `${dirtyCount} Unsaved Changes` : config.label;

  return (
    <span className={cn('hidden items-center gap-1.5 text-xs sm:inline-flex', config.className)}>
      {Icon && <Icon className={cn('size-3', status === 'saving' && 'animate-spin')} />}
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
