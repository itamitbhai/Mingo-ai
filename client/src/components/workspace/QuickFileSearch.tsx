'use client';

import { FileEntryType, type IFileTreeNode } from 'shared';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { getFileIcon } from '@/utils/file-icons';

function flattenFiles(nodes: IFileTreeNode[]): IFileTreeNode[] {
  const files: IFileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === FileEntryType.FILE) {
      files.push(node);
    } else if (node.children) {
      files.push(...flattenFiles(node.children));
    }
  }
  return files;
}

interface QuickFileSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: IFileTreeNode[];
  onSelect: (node: IFileTreeNode) => void;
}

export function QuickFileSearch({ open, onOpenChange, tree, onSelect }: QuickFileSearchProps) {
  const files = flattenFiles(tree);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick File Search"
      description="Jump to a file by name"
    >
      <CommandInput placeholder="Search files by name..." />
      <CommandList>
        <CommandEmpty>No files found.</CommandEmpty>
        <CommandGroup heading="Files">
          {files.map((file) => {
            const Icon = getFileIcon(file.language, file.name);
            return (
              <CommandItem
                key={file.path}
                value={`${file.name} ${file.path}`}
                onSelect={() => {
                  onSelect(file);
                  onOpenChange(false);
                }}
              >
                <Icon className="size-4" />
                <span>{file.name}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{file.path}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
