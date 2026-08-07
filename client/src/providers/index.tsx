'use client';

import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider } from './clerk-provider';
import { ThemeProvider } from './theme-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ClerkProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}
