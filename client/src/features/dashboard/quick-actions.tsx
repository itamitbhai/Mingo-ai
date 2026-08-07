import Link from 'next/link';
import { CreditCard, LayoutTemplate, Rocket } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { NewProjectButton } from './new-project-button';

const ACTIONS = [
  { label: 'Browse templates', href: '/templates', icon: LayoutTemplate },
  { label: 'View deployments', href: '/deployments', icon: Rocket },
  { label: 'Manage billing', href: '/billing', icon: CreditCard },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-card/60">
        <CardContent className="flex h-full flex-col items-start justify-between gap-3">
          <p className="text-sm font-medium">Start something new</p>
          <NewProjectButton className="w-full" />
        </CardContent>
      </Card>
      {ACTIONS.map((action) => (
        <Link key={action.href} href={action.href} className="block h-full">
          <Card className="h-full bg-card/60 transition-colors hover:bg-accent/40">
            <CardContent className="flex h-full flex-col items-start justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <action.icon className="size-5 text-foreground" />
              </div>
              <p className="text-sm font-medium">{action.label}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
