import type { IActivity } from 'shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACTIVITY_ICONS } from '@/utils/activity';
import { formatRelativeTime } from '@/utils/format';

export function RecentActivity({ activity }: { activity: IActivity[] }) {
  return (
    <Card className="h-full bg-card/60">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No activity yet — actions you take will show up here.
          </p>
        ) : (
          <ul className="space-y-4">
            {activity.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type];
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">{item.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
