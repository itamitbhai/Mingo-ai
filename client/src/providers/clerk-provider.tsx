'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ClerkProvider as BaseClerkProvider } from '@clerk/nextjs';
import { dark, shadcn } from '@clerk/themes';
import { useTheme } from 'next-themes';

const clerkVariables = {
  colorPrimary: 'oklch(0.68 0.19 291)',
  colorBackground: 'var(--card)',
  colorInputBackground: 'var(--input)',
  colorInputText: 'var(--foreground)',
  colorText: 'var(--foreground)',
  colorTextSecondary: 'var(--muted-foreground)',
  colorDanger: 'var(--destructive)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-sans)',
};

export function ClerkProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isLight = mounted && resolvedTheme === 'light';

  return (
    <BaseClerkProvider
      appearance={{
        theme: isLight ? shadcn : [shadcn, dark],
        variables: clerkVariables,
        elements: {
          card: 'shadow-none',
          rootBox: 'w-full',
        },
      }}
    >
      {children}
    </BaseClerkProvider>
  );
}
