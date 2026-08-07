'use client';

import { usePathname } from 'next/navigation';
import type { IUser } from 'shared';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { DASHBOARD_NAV_ITEMS } from '@/lib/constants';
import { getInitials } from '@/utils/format';
import { MobileSidebar } from './mobile-sidebar';
import { UserMenu } from './user-menu';

function getPageTitle(pathname: string): string {
  const match = DASHBOARD_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.label ?? 'Dashboard';
}

export function Topbar({ user }: { user: IUser }) {
  const pathname = usePathname();

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-sidebar-border px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileSidebar user={user} />
        <h1 className="text-base font-semibold sm:text-lg">{getPageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu
          user={user}
          trigger={
            <button className="rounded-full ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-9">
                <AvatarImage src={user.avatarUrl} alt={user.firstName} />
                <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
              </Avatar>
            </button>
          }
        />
      </div>
    </header>
  );
}
