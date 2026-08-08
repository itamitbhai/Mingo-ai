'use client';

import Link from 'next/link';
import { AlertCircle, Loader2, MessageSquare, PanelBottom, PanelLeft, Save, Settings, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FileStatus } from '@/types/workspace';

interface WorkspaceHeaderProps {
  projectId: string;
  projectName: string;
  saveStatus: FileStatus;
  isExplorerOpen: boolean;
  isAIChatOpen: boolean;
  isBottomPanelOpen: boolean;
  onToggleExplorer: () => void;
  onToggleAIChat: () => void;
  onToggleBottomPanel: () => void;
  onSave: () => void;
  onOpenSettings: () => void;
}

const STATUS_LABEL: Record<FileStatus, string> = {
  idle: 'No file open',
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
  conflict: 'Conflict — reload',
};

export function WorkspaceHeader({
  projectId,
  projectName,
  saveStatus,
  isExplorerOpen,
  isAIChatOpen,
  isBottomPanelOpen,
  onToggleExplorer,
  onToggleAIChat,
  onToggleBottomPanel,
  onSave,
  onOpenSettings,
}: WorkspaceHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Mingo AI
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`/projects/${projectId}`}
          className="truncate text-sm text-muted-foreground hover:text-foreground"
        >
          {projectName}
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          {saveStatus === 'saving' && <Loader2 className="size-3 animate-spin" />}
          {saveStatus === 'error' && <AlertCircle className="size-3 text-destructive" />}
          <span className={cn(saveStatus === 'conflict' && 'text-destructive')}>
            {STATUS_LABEL[saveStatus]}
          </span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggleExplorer}
          aria-label="Toggle explorer"
          aria-pressed={isExplorerOpen}
        >
          <PanelLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggleBottomPanel}
          aria-label="Toggle bottom panel"
          aria-pressed={isBottomPanelOpen}
        >
          <PanelBottom className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggleAIChat}
          aria-label="Toggle AI chat"
          aria-pressed={isAIChatOpen}
        >
          <MessageSquare className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onSave}>
          <Save className="size-4" /> Save
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onOpenSettings}
          aria-label="Editor settings"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </div>
  );
}
