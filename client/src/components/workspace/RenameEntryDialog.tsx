'use client';

import { useEffect, useState } from 'react';
import type { IFileTreeNode } from 'shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface RenameEntryDialogProps {
  node: IFileTreeNode | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (newName: string) => Promise<boolean>;
}

export function RenameEntryDialog({ node, onOpenChange, onSubmit }: RenameEntryDialogProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (node) setName(node.name);
  }, [node]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting || trimmed === node?.name) return;
    setIsSubmitting(true);
    await onSubmit(trimmed);
    setIsSubmitting(false);
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename {node?.type === 'folder' ? 'folder' : 'file'}</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="New name"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
