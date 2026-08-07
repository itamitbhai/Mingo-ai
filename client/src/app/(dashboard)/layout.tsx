import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { CreateProjectModal } from '@/features/projects/create-project-modal';
import { EditProjectModal } from '@/features/projects/edit-project-modal';
import { Sidebar } from '@/features/dashboard/sidebar';
import { Topbar } from '@/features/dashboard/topbar';
import { getServerAuthToken } from '@/lib/auth-server';
import { getProfile } from '@/services/profile.service';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = await getServerAuthToken();

  if (!token) {
    redirect('/sign-in');
  }

  const user = await getProfile(token);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <CreateProjectModal />
      <EditProjectModal />
    </div>
  );
}
