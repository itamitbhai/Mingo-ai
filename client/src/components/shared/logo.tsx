import Link from 'next/link';

import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="mingo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mingo-gradient)" />
      <path
        d="M9 22V10.6c0-.7.8-1.1 1.4-.6l5.6 5 5.6-5c.6-.5 1.4-.1 1.4.6V22"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  className,
  iconOnly = false,
  href = '/',
}: {
  className?: string;
  iconOnly?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}
    >
      <LogoMark />
      {!iconOnly && <span className="text-base">Mingo AI</span>}
    </Link>
  );
}
