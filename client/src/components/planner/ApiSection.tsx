import { Lock, LockOpen } from 'lucide-react';
import type { IPlanApiEndpoint } from 'shared';

import { Badge } from '@/components/ui/badge';

const METHOD_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'default' | 'outline'> = {
  GET: 'success',
  POST: 'default',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'destructive',
};

interface ApiSectionProps {
  api: IPlanApiEndpoint[] | undefined;
}

export function ApiSection({ api }: ApiSectionProps) {
  if (!api || api.length === 0) {
    return <p className="text-sm text-muted-foreground">No API endpoints were planned.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {api.map((endpoint, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={METHOD_VARIANT[endpoint.method.toUpperCase()] ?? 'outline'} className="font-mono">
              {endpoint.method.toUpperCase()}
            </Badge>
            <code className="text-sm">{endpoint.path}</code>
            {endpoint.authRequired ? (
              <Lock className="size-3.5 text-muted-foreground" aria-label="Requires authentication" />
            ) : (
              <LockOpen className="size-3.5 text-muted-foreground" aria-label="Public" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{endpoint.purpose}</p>
        </div>
      ))}
    </div>
  );
}
