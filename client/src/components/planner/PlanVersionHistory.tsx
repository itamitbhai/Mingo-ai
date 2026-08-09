import type { IProjectPlan } from 'shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  draft: 'outline',
  generating: 'outline',
  ready: 'default',
  approved: 'success',
  rejected: 'destructive',
  failed: 'destructive',
  executing: 'warning',
  completed: 'success',
  cancelled: 'outline',
};

interface PlanVersionHistoryProps {
  plans: IProjectPlan[];
  currentPlanId: string | undefined;
  onSelect: (plan: IProjectPlan) => void;
}

export function PlanVersionHistory({ plans, currentPlanId, onSelect }: PlanVersionHistoryProps) {
  if (plans.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Versions:</span>
      {plans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => onSelect(plan)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
            plan.id === currentPlanId
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          v{plan.version}
          <Badge variant={STATUS_VARIANT[plan.status] ?? 'outline'} className="h-4 px-1.5 py-0 text-[10px] capitalize">
            {plan.status}
          </Badge>
        </button>
      ))}
    </div>
  );
}
