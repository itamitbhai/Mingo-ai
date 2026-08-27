'use client';

import Link from 'next/link';
import {
  Bot,
  History,
  ListChecks,
  MessageSquare,
  PanelBottom,
  PanelLeft,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Camera,
  Wand2,
  Workflow,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WorkspaceUiStatus } from '@/store/use-workspace-store';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';

interface WorkspaceHeaderProps {
  projectId: string;
  projectName: string;
  workspaceStatus: WorkspaceUiStatus;
  dirtyCount: number;
  isExplorerOpen: boolean;
  isAIChatOpen: boolean;
  isAgentPanelOpen: boolean;
  isWorkflowPanelOpen: boolean;
  isBottomPanelOpen: boolean;
  onToggleExplorer: () => void;
  onToggleAIChat: () => void;
  onToggleAgentPanel: () => void;
  onToggleWorkflowPanel: () => void;
  onToggleBottomPanel: () => void;
  onSave: () => void;
  onOpenSettings: () => void;
  onRefreshWorkspace: () => void;
  onOpenSnapshots: () => void;
  onOpenHistory: () => void;
  onOpenBatchOperations: () => void;
}

export function WorkspaceHeader({
  projectId,
  projectName,
  workspaceStatus,
  dirtyCount,
  isExplorerOpen,
  isAIChatOpen,
  isAgentPanelOpen,
  isWorkflowPanelOpen,
  isBottomPanelOpen,
  onToggleExplorer,
  onToggleAIChat,
  onToggleAgentPanel,
  onToggleWorkflowPanel,
  onToggleBottomPanel,
  onSave,
  onOpenSettings,
  onRefreshWorkspace,
  onOpenSnapshots,
  onOpenHistory,
  onOpenBatchOperations,
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
        <WorkspaceStatusBadge status={workspaceStatus} dirtyCount={dirtyCount} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Workspace
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${projectId}/plan`}>
                <Wand2 className="size-4" /> Plan with Mingo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRefreshWorkspace}>
              <RefreshCw className="size-4" /> Refresh
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenSnapshots}>
              <Camera className="size-4" /> Snapshots
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenHistory}>
              <History className="size-4" /> History
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenBatchOperations}>
              <ListChecks className="size-4" /> Batch Operations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggleAgentPanel}
          aria-label="Toggle Frontend Agent"
          aria-pressed={isAgentPanelOpen}
        >
          <Bot className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggleWorkflowPanel}
          aria-label="Toggle Workflow"
          aria-pressed={isWorkflowPanelOpen}
        >
          <Workflow className="size-4" />
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
