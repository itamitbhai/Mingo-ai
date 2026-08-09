import { AlertTriangle, CheckCircle2, ListChecks, Puzzle } from 'lucide-react';
import type { IProjectPlan } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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

interface PlanOverviewProps {
  plan: IProjectPlan;
}

export function PlanOverview({ plan }: PlanOverviewProps) {
  const featureCount = plan.features?.length ?? 0;
  const taskCount = plan.tasks?.length ?? 0;
  const riskCount = plan.risks?.length ?? 0;

  return (
    <Card className="bg-card/60">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{plan.projectType ?? 'Project plan'}</h2>
              <Badge variant={STATUS_VARIANT[plan.status] ?? 'outline'} className="capitalize">
                {plan.status}
              </Badge>
              <Badge variant="outline">v{plan.version}</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{plan.summary}</p>
          </div>
          <p className="text-xs whitespace-nowrap text-muted-foreground">
            {new Date(plan.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
            <Puzzle className="size-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Features</p>
              <p className="text-sm font-medium">{featureCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
            <ListChecks className="size-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Tasks</p>
              <p className="text-sm font-medium">{taskCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
            {riskCount > 0 ? (
              <AlertTriangle className="size-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            <div>
              <p className="text-xs text-muted-foreground">Risks</p>
              <p className="text-sm font-medium">{riskCount}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
