'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import type { IUser } from 'shared';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/format';
import { SidebarNav } from './sidebar-nav';

export function MobileSidebar({ user }: { user: IUser }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="h-16 justify-center border-b border-sidebar-border">
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col py-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3.5">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
