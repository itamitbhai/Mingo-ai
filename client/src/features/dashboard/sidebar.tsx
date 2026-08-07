import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { IUser } from 'shared';
import { PLAN_LIMITS, PlanType } from 'shared';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { getInitials } from '@/utils/format';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function Sidebar({ user }: { user: IUser }) {
  const plan = (user.plan ?? PlanType.FREE) as PlanType;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo href="/dashboard" />
      </div>

      <SidebarNav />

      {plan === PlanType.FREE && (
        <div className="mx-3 mb-4 rounded-xl border border-primary/20 bg-primary/10 p-3.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Upgrade to Pro
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Unlock up to {PLAN_LIMITS[PlanType.PRO].projects} projects and priority support.
          </p>
          <Button size="sm" className="mt-3 w-full" asChild>
            <Link href="/billing">Upgrade plan</Link>
          </Button>
        </div>
      )}

      <UserMenu
        user={user}
        trigger={
          <button className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3.5 text-left hover:bg-sidebar-accent">
            <Avatar className="size-9">
              <AvatarImage src={user.avatarUrl} alt={user.firstName} />
              <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </button>
        }
      />
    </aside>
  );
}
