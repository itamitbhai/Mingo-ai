'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GradientOrbs } from '@/components/shared/gradient-orbs';
import { Logo } from '@/components/shared/logo';

export default function GlobalError({
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      <GradientOrbs />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <Logo />
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            We couldn&apos;t load this page. This can happen if the API is unreachable — please
            try again.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button onClick={() => reset()}>
            <RotateCw className="size-4" /> Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
