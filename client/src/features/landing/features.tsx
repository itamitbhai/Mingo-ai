'use client';

import { motion } from 'framer-motion';
import { Bot, FolderKanban, GitBranch, MonitorPlay, Rocket, SquareCode } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI Software Engineer',
    description:
      'An AI engineer that plans, writes, and reviews code alongside you — arriving in a future phase.',
    status: 'Coming soon',
  },
  {
    icon: MonitorPlay,
    title: 'Live Workspace',
    description:
      'A real-time collaborative workspace for your team to build and iterate together.',
    status: 'Coming soon',
  },
  {
    icon: FolderKanban,
    title: 'Project Management',
    description:
      'Create, organize, and track every project with rich metadata, status, and activity history.',
    status: 'Available now',
  },
  {
    icon: GitBranch,
    title: 'GitHub Ready',
    description: 'Push straight to a repository and keep your codebase in sync automatically.',
    status: 'Coming soon',
  },
  {
    icon: Rocket,
    title: 'Deployment Ready',
    description: 'One-click deploys to Vercel, Railway, or Render as soon as you are ready to ship.',
    status: 'Coming soon',
  },
  {
    icon: SquareCode,
    title: 'Built-in IDE',
    description: 'A full in-browser editor with terminal access for end-to-end development.',
    status: 'Coming soon',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-primary">Everything you need</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            One platform for your entire engineering workflow
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Mingo AI is being built in phases. Here&apos;s the full vision — and what you can use
            today.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
            >
              <Card className="glass-card h-full transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl gradient-bg glow-primary">
                      <feature.icon className="size-5 text-primary-foreground" />
                    </div>
                    <Badge variant={feature.status === 'Available now' ? 'success' : 'secondary'}>
                      {feature.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
