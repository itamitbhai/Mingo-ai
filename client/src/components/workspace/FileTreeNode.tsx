'use client';

import { ChevronDown, ChevronRight, Copy, FilePlus, FolderPlus, Move, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { FileEntryType, type IFileTreeNode } from 'shared';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { getFileIcon, getFolderIcon } from '@/utils/file-icons';

export interface FileTreeActions {
  onOpenFile: (node: IFileTreeNode) => void;
  onToggleFolder: (path: string) => void;
  onCreate: (parentPath: string, type: FileEntryType) => void;
  onRename: (node: IFileTreeNode) => void;
  onMove: (node: IFileTreeNode) => void;
  onDelete: (node: IFileTreeNode) => void;
  onCopyPath: (path: string) => void;
  onAskAI: (node: IFileTreeNode) => void;
}

interface FileTreeNodeProps extends FileTreeActions {
  node: IFileTreeNode;
  depth: number;
  activePath: string | null;
  expandedFolders: string[];
}

export function FileTreeNode({
  node,
  depth,
  activePath,
  expandedFolders,
  ...actions
}: FileTreeNodeProps) {
  const isFolder = node.type === FileEntryType.FOLDER;
  const isExpanded = isFolder && expandedFolders.includes(node.path);
  const isActive = activePath === node.path;
  const Icon = isFolder ? getFolderIcon(isExpanded) : getFileIcon(node.language, node.name);

  function handleClick() {
    if (isFolder) {
      actions.onToggleFolder(node.path);
    } else {
      actions.onOpenFile(node);
    }
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors',
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            )}
          >
            {isFolder ? (
              isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="size-3.5 shrink-0" />
            )}
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{node.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {isFolder ? (
            <>
              <ContextMenuItem onSelect={() => actions.onCreate(node.path, FileEntryType.FILE)}>
                <FilePlus className="size-4" /> New File
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => actions.onCreate(node.path, FileEntryType.FOLDER)}>
                <FolderPlus className="size-4" /> New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          ) : (
            <>
              <ContextMenuItem onSelect={() => actions.onOpenFile(node)}>Open</ContextMenuItem>
              <ContextMenuItem onSelect={() => actions.onAskAI(node)}>
                <Sparkles className="size-4" /> Ask Mingo AI
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onSelect={() => actions.onRename(node)}>
            <Pencil className="size-4" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => actions.onMove(node)}>
            <Move className="size-4" /> Move
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => actions.onCopyPath(node.path)}>
            <Copy className="size-4" /> Copy Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => actions.onDelete(node)}>
            <Trash2 className="size-4" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              expandedFolders={expandedFolders}
              {...actions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
