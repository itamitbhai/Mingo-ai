'use client';

import type { IFileTreeNode } from 'shared';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteEntryDialogProps {
  node: IFileTreeNode | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function DeleteEntryDialog({ node, onOpenChange, onConfirm }: DeleteEntryDialogProps) {
  const isFolder = node?.type === 'folder';

  return (
    <AlertDialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{node?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {isFolder
              ? 'This permanently deletes the folder and everything inside it. This action cannot be undone.'
              : 'This permanently deletes the file. This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
