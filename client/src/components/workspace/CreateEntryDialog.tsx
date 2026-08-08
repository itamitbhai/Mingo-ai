'use client';

import { useEffect, useState } from 'react';
import { FileEntryType } from 'shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface CreateEntryState {
  parentPath: string;
  type: FileEntryType;
}

interface CreateEntryDialogProps {
  state: CreateEntryState | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<boolean>;
}

export function CreateEntryDialog({ state, onOpenChange, onSubmit }: CreateEntryDialogProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (state) setName('');
  }, [state]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    const ok = await onSubmit(trimmed);
    setIsSubmitting(false);
    if (!ok) {
      // Keep the dialog open with the entered name so the user can adjust and retry.
    }
  }

  const isFile = state?.type === FileEntryType.FILE;

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isFile ? 'New File' : 'New Folder'}</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isFile ? 'UserCard.tsx' : 'components'}
          aria-label="Name"
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
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
