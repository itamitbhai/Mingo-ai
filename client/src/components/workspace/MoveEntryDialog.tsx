'use client';

import { useEffect, useState } from 'react';
import type { IFileTreeNode } from 'shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface MoveEntryDialogProps {
  node: IFileTreeNode | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (destinationPath: string) => Promise<boolean>;
}

export function MoveEntryDialog({ node, onOpenChange, onSubmit }: MoveEntryDialogProps) {
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (node) setDestination(node.path);
  }, [node]);

  async function handleSubmit() {
    const trimmed = destination.trim();
    if (!trimmed || isSubmitting || trimmed === node?.path) return;
    setIsSubmitting(true);
    const ok = await onSubmit(trimmed);
    setIsSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move {node?.type === 'folder' ? 'folder' : 'file'}</DialogTitle>
          <DialogDescription>Enter the new path for &ldquo;{node?.path}&rdquo;.</DialogDescription>
        </DialogHeader>
        <Input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          aria-label="Destination path"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSubmit();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!destination.trim() || isSubmitting}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
