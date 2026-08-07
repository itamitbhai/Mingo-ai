import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GradientOrbs } from '@/components/shared/gradient-orbs';
import { Logo } from '@/components/shared/logo';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      <GradientOrbs />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <Logo />
        <p className="gradient-text text-7xl font-semibold sm:text-8xl">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="size-4" /> Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
