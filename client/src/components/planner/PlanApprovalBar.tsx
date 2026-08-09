import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { ProjectPlanStatus, type IProjectPlan } from 'shared';

import { Button } from '@/components/ui/button';

interface PlanApprovalBarProps {
  plan: IProjectPlan;
  isSubmitting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

export function PlanApprovalBar({ plan, isSubmitting, onApprove, onReject, onRegenerate }: PlanApprovalBarProps) {
  const canDecide = plan.status === ProjectPlanStatus.READY;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Approving a plan only marks it as accepted — it does not execute any tasks, write files, or
        run commands.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Regenerate
        </Button>
        {canDecide && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isSubmitting}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="size-4" /> Reject
            </Button>
            <Button size="sm" onClick={onApprove} disabled={isSubmitting}>
              <CheckCircle2 className="size-4" /> Approve Plan
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
