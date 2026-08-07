import { Activity, FolderKanban, Layers, Rocket } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { DashboardStats } from '@/types/dashboard';

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: 'Total Projects', value: stats.totalProjects, icon: FolderKanban },
    { label: 'Active Projects', value: stats.activeProjects, icon: Activity },
    { label: 'Deployments', value: stats.totalDeployments, icon: Rocket },
    { label: 'Current Plan', value: stats.planLabel, icon: Layers },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/60">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold">{item.value}</p>
            </div>
            <div className="gradient-bg glow-primary flex size-11 items-center justify-center rounded-xl">
              <item.icon className="size-5 text-primary-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
