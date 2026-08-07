'use client';

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import type { DashboardStats } from '@/types/dashboard';

const SAMPLE_DATA = [
  { month: 'Mar', projects: 2 },
  { month: 'Apr', projects: 4 },
  { month: 'May', projects: 3 },
  { month: 'Jun', projects: 6 },
  { month: 'Jul', projects: 8 },
  { month: 'Aug', projects: 11 },
];

const chartConfig = {
  projects: { label: 'Projects created', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export function UsageChart({ stats }: { stats: DashboardStats }) {
  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle>Project activity</CardTitle>
        <CardDescription>Projects created over the last 6 months (sample data)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <AreaChart data={SAMPLE_DATA} margin={{ left: -20, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="fillProjects" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-projects)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-projects)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="projects"
              type="monotone"
              fill="url(#fillProjects)"
              stroke="var(--color-projects)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>

        <div className="mt-6 space-y-2 border-t border-border/60 pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Plan usage ({stats.totalProjects}
              {stats.projectLimit ? ` / ${stats.projectLimit}` : ''} projects)
            </span>
            <span className="font-medium">
              {stats.projectLimit ? `${stats.usagePercentage}%` : 'Unlimited'}
            </span>
          </div>
          <Progress value={stats.projectLimit ? stats.usagePercentage : 100} />
        </div>
      </CardContent>
    </Card>
  );
}
