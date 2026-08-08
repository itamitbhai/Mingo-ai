'use client';

import { X } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { EditorTab } from '@/types/workspace';
import { getFileIcon } from '@/utils/file-icons';

interface EditorTabsProps {
  tabs: EditorTab[];
  dirtyPaths: ReadonlySet<string>;
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseAll: () => void;
}

export function EditorTabs({
  tabs,
  dirtyPaths,
  activePath,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: EditorTabsProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-stretch overflow-x-auto border-b border-border bg-card/30">
      {tabs.map((tab) => {
        const Icon = getFileIcon(tab.language, tab.name);
        const isActive = tab.path === activePath;
        const isDirty = dirtyPaths.has(tab.path);

        return (
          <ContextMenu key={tab.path}>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                onClick={() => onSelect(tab.path)}
                className={cn(
                  'group flex shrink-0 items-center gap-2 border-r border-border px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:bg-accent/40'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="max-w-40 truncate">{tab.name}</span>
                <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                  {isDirty && (
                    <span
                      className="absolute size-1.5 rounded-full bg-foreground/70 group-hover:opacity-0"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(tab.path);
                    }}
                    className="absolute rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                    aria-label={`Close ${tab.name}`}
                  >
                    <X className="size-3.5" />
                  </span>
                </span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => onClose(tab.path)}>Close</ContextMenuItem>
              <ContextMenuItem onSelect={() => onCloseOthers(tab.path)}>Close Others</ContextMenuItem>
              <ContextMenuItem onSelect={onCloseAll}>Close All</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
