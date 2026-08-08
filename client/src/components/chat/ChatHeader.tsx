'use client';

import { Menu, Plus } from 'lucide-react';
import type { IProject } from 'shared';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTechStackBadges } from '@/utils/tech-stack';

interface ChatHeaderProps {
  project: Pick<
    IProject,
    'name' | 'frontend' | 'backend' | 'database' | 'authentication' | 'styling' | 'deployment'
  >;
  isStreaming: boolean;
  onNewChat: () => void;
  onOpenSidebar: () => void;
}

export function ChatHeader({ project, isStreaming, onNewChat, onOpenSidebar }: ChatHeaderProps) {
  const badges = getTechStackBadges(project);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open conversations"
        >
          <Menu className="size-4" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{project.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {badges.map((badge) => badge.label).join(' · ')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
          <span
            className={cn(
              'size-1.5 rounded-full',
              isStreaming ? 'animate-pulse bg-primary' : 'bg-emerald-500'
            )}
          />
          {isStreaming ? 'Generating' : 'Ready'}
        </span>
        <Button variant="outline" size="sm" onClick={onNewChat}>
          <Plus className="size-4" /> New Chat
        </Button>
      </div>
    </div>
  );
}
