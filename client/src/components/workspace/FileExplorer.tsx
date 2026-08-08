'use client';

import { useState } from 'react';
import { FilePlus, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { FileEntryType, type IFileTreeNode } from 'shared';

import { Button } from '@/components/ui/button';
import { useWorkspaceUIStore } from '@/store/use-workspace-ui-store';
import type { AIContextAttachment } from '@/types/workspace';
import { CreateEntryDialog, type CreateEntryState } from './CreateEntryDialog';
import { DeleteEntryDialog } from './DeleteEntryDialog';
import { FileTreeNode } from './FileTreeNode';
import { RenameEntryDialog } from './RenameEntryDialog';

interface FileExplorerProps {
  projectId: string;
  tree: IFileTreeNode[];
  activePath: string | null;
  onOpenFile: (node: IFileTreeNode) => void;
  onCreateFile: (path: string) => Promise<boolean>;
  onCreateFolder: (path: string) => Promise<boolean>;
  onRename: (path: string, newName: string) => Promise<boolean>;
  onDelete: (path: string) => Promise<boolean>;
  onAskAI: (attachment: AIContextAttachment) => void;
}

export function FileExplorer({
  projectId,
  tree,
  activePath,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onAskAI,
}: FileExplorerProps) {
  const expandedFolders = useWorkspaceUIStore((state) => state.getProjectUI(projectId).expandedFolders);
  const toggleFolder = useWorkspaceUIStore((state) => state.toggleFolder);

  const [createState, setCreateState] = useState<CreateEntryState | null>(null);
  const [renameState, setRenameState] = useState<IFileTreeNode | null>(null);
  const [deleteState, setDeleteState] = useState<IFileTreeNode | null>(null);

  async function handleCopyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      toast.success('Path copied');
    } catch {
      toast.error('Could not copy path');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground">EXPLORER</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="New file"
            onClick={() => setCreateState({ parentPath: '', type: FileEntryType.FILE })}
          >
            <FilePlus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="New folder"
            onClick={() => setCreateState({ parentPath: '', type: FileEntryType.FOLDER })}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {tree.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No files yet</p>
        ) : (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              expandedFolders={expandedFolders}
              onOpenFile={onOpenFile}
              onToggleFolder={(path) => toggleFolder(projectId, path)}
              onCreate={(parentPath, type) => setCreateState({ parentPath, type })}
              onRename={setRenameState}
              onDelete={setDeleteState}
              onCopyPath={handleCopyPath}
              onAskAI={(fileNode) => {
                onOpenFile(fileNode);
                onAskAI({ filePath: fileNode.path, language: fileNode.language ?? 'plaintext' });
              }}
            />
          ))
        )}
      </div>

      <CreateEntryDialog
        state={createState}
        onOpenChange={(open) => !open && setCreateState(null)}
        onSubmit={async (name) => {
          if (!createState) return false;
          const path = createState.parentPath ? `${createState.parentPath}/${name}` : name;
          const ok =
            createState.type === FileEntryType.FILE
              ? await onCreateFile(path)
              : await onCreateFolder(path);
          if (ok) setCreateState(null);
          return ok;
        }}
      />

      <RenameEntryDialog
        node={renameState}
        onOpenChange={(open) => !open && setRenameState(null)}
        onSubmit={async (newName) => {
          if (!renameState) return false;
          const ok = await onRename(renameState.path, newName);
          if (ok) setRenameState(null);
          return ok;
        }}
      />

      <DeleteEntryDialog
        node={deleteState}
        onOpenChange={(open) => !open && setDeleteState(null)}
        onConfirm={async () => {
          if (!deleteState) return;
          const ok = await onDelete(deleteState.path);
          if (ok) setDeleteState(null);
        }}
      />
    </div>
  );
}
