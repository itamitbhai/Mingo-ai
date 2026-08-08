import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { Providers } from '@/providers';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Mingo AI — Build Production-Ready Apps with AI',
    template: '%s | Mingo AI',
  },
  description:
    'Mingo AI is the AI-powered software engineering platform for planning, managing, and shipping production-ready applications faster.',
  keywords: ['Mingo AI', 'AI software engineer', 'SaaS platform', 'project management', 'AI development'],
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Mingo AI — Build Production-Ready Apps with AI',
    description:
      'Plan, manage, and ship production-ready applications with an AI-powered software engineering platform.',
    url: appUrl,
    siteName: 'Mingo AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mingo AI — Build Production-Ready Apps with AI',
    description:
      'Plan, manage, and ship production-ready applications with an AI-powered software engineering platform.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0d0d12' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body
        className="min-h-screen bg-background font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
