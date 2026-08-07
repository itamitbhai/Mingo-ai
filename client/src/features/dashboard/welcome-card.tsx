import type { IUser } from 'shared';

import { Card, CardContent } from '@/components/ui/card';
import { NewProjectButton } from './new-project-button';

export function WelcomeCard({ user }: { user: IUser }) {
  return (
    <Card className="glass-card relative overflow-hidden">
      <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{user.firstName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across {user.workspace}.
          </p>
        </div>
        <NewProjectButton size="lg" />
      </CardContent>
    </Card>
  );
}
