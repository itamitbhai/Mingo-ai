'use client';

import { Loader2, Pause, Play, XCircle } from 'lucide-react';
import { WorkflowStatus } from 'shared';

import { Button } from '@/components/ui/button';

interface WorkflowControlsProps {
  status: WorkflowStatus;
  isBusy: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const TERMINAL_STATUSES: string[] = [WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED];
const RESUMABLE_STATUSES: string[] = [WorkflowStatus.PAUSED, WorkflowStatus.WAITING_FOR_APPROVAL, WorkflowStatus.FAILED];

/** Start/Pause/Resume/Cancel (spec §17/§53/§54) — "Start" itself isn't a button here since a
 *  workflow is already running the moment it's created; this only ever controls an existing one. */
export function WorkflowControls({ status, isBusy, onPause, onResume, onCancel }: WorkflowControlsProps) {
  if (TERMINAL_STATUSES.includes(status)) return null;

  const canPause = status === WorkflowStatus.RUNNING || status === WorkflowStatus.TESTING || status === WorkflowStatus.FIXING;
  const canResume = RESUMABLE_STATUSES.includes(status);

  return (
    <div className="flex items-center gap-2">
      {canPause && (
        <Button size="sm" variant="outline" onClick={onPause} disabled={isBusy}>
          <Pause className="size-3.5" /> Pause
        </Button>
      )}
      {canResume && (
        <Button size="sm" variant="outline" onClick={onResume} disabled={isBusy}>
          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Resume
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onCancel} disabled={isBusy} className="text-destructive hover:text-destructive">
        <XCircle className="size-3.5" /> Cancel
      </Button>
    </div>
  );
}
