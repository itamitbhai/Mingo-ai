import type { IPlanStack, IPlanStackEntry, TechSource } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const CATEGORY_LABELS: Record<keyof IPlanStack, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  authentication: 'Authentication',
  payments: 'Payments',
  storage: 'Storage',
  styling: 'Styling',
  testing: 'Testing',
  deployment: 'Deployment',
};

const SOURCE_LABELS: Record<TechSource, string> = {
  user_selected: 'User selected',
  inferred: 'Inferred',
  recommended: 'Recommended',
};

const SOURCE_VARIANT: Record<TechSource, 'default' | 'success' | 'outline'> = {
  user_selected: 'success',
  inferred: 'outline',
  recommended: 'default',
};

interface StackSectionProps {
  stack: IPlanStack | undefined;
}

export function StackSection({ stack }: StackSectionProps) {
  const entries = Object.entries(stack ?? {}) as [keyof IPlanStack, IPlanStackEntry | undefined][];
  const populated = entries.filter(([, entry]) => Boolean(entry));

  if (populated.length === 0) {
    return <p className="text-sm text-muted-foreground">No technology stack was determined.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {populated.map(([key, entry]) => (
        <Card key={key} className="bg-card/60">
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[key]}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{entry?.name}</span>
              <Badge variant={entry ? SOURCE_VARIANT[entry.source] : 'outline'}>
                {entry ? SOURCE_LABELS[entry.source] : ''}
              </Badge>
            </div>
            {entry?.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
