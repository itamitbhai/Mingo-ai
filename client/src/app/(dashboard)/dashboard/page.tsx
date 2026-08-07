import type { Metadata } from 'next';

import { QuickActions } from '@/features/dashboard/quick-actions';
import { RecentActivity } from '@/features/dashboard/recent-activity';
import { RecentProjects } from '@/features/dashboard/recent-projects';
import { StatsCards } from '@/features/dashboard/stats-cards';
import { UsageChart } from '@/features/dashboard/usage-chart';
import { WelcomeCard } from '@/features/dashboard/welcome-card';
import { getServerAuthToken } from '@/lib/auth-server';
import { getDashboardOverview } from '@/services/dashboard.service';
import { getProfile } from '@/services/profile.service';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const token = await getServerAuthToken();
  const [user, overview] = await Promise.all([getProfile(token), getDashboardOverview(token)]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <WelcomeCard user={user} />
      <StatsCards stats={overview.stats} />
      <QuickActions />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UsageChart stats={overview.stats} />
        </div>
        <RecentActivity activity={overview.recentActivity} />
      </div>
      <RecentProjects projects={overview.recentProjects} />
    </div>
  );
}
