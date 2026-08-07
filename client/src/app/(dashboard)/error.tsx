'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center py-20">
      <Card className="w-full bg-card/60">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Couldn&apos;t load this page</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Something went wrong talking to the Mingo AI API. Check that the server is running
              and your environment variables are configured, then try again.
            </p>
          </div>
          <Button onClick={() => reset()}>
            <RotateCw className="size-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
