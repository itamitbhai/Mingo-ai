import type { Metadata } from 'next';
import { Rocket } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';

export const metadata: Metadata = {
  title: 'Deployments',
};

export default function DeploymentsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <EmptyState
        icon={Rocket}
        title="Deployments are coming in a future phase"
        description="One-click deploys to Vercel, Railway, and Render will show up here once the deployment engine ships. For now, set a project's intended deployment target from its project page."
      />
    </div>
  );
}
