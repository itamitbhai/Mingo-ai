import type { Metadata } from 'next';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BillingPlans } from '@/features/billing/billing-plans';
import { getServerAuthToken } from '@/lib/auth-server';
import { getDashboardOverview } from '@/services/dashboard.service';

export const metadata: Metadata = {
  title: 'Billing',
};

export default async function BillingPage() {
  const token = await getServerAuthToken();
  const { stats } = await getDashboardOverview(token);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card className="bg-card/60">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current usage</p>
            <p className="text-lg font-semibold">
              {stats.totalProjects}
              {stats.projectLimit ? ` / ${stats.projectLimit}` : ''} projects
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Progress value={stats.projectLimit ? stats.usagePercentage : 100} />
          </div>
        </CardContent>
      </Card>

      <BillingPlans currentPlan={stats.plan} />
    </div>
  );
}
