'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { DASHBOARD_NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {DASHBOARD_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'gradient-bg text-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <item.icon className={cn('size-4.5 shrink-0', isActive && 'text-primary-foreground')} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
