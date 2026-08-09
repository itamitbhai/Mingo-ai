'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import * as workspaceService from '@/services/workspace/workspace.service';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface BatchOperationsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}

const PLACEHOLDER = `[
  { "type": "create", "path": "src/auth/auth.service.ts", "content": "export {};\\n" }
]`;

const ACTION_VARIANT: Record<'CREATE' | 'MODIFY' | 'DELETE', 'success' | 'warning' | 'destructive'> = {
  CREATE: 'success',
  MODIFY: 'warning',
  DELETE: 'destructive',
};

/**
 * Manual entry point for workspace batch operations (spec §23-25/§41). AI-generated operations
 * will drive this same preview → apply flow in a future phase; for Phase 4 the operations are
 * typed in by hand as JSON.
 */
export function BatchOperationsDialog({ projectId, open, onOpenChange, onApplied }: BatchOperationsDialogProps) {
  const { getToken } = useAuth();
  const pendingOperations = useWorkspaceStore((state) => state.pendingOperations);
  const setPendingOperations = useWorkspaceStore((state) => state.setPendingOperations);

  const [raw, setRaw] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  function parseOperations() {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of operations');
      return parsed;
    } catch {
      toast.error('Invalid JSON — expected an array of operations');
      return null;
    }
  }

  async function handlePreview() {
    const operations = parseOperations();
    if (!operations || isPreviewing) return;

    setIsPreviewing(true);
    try {
      const token = await getToken();
      const result = await workspaceService.previewOperations(projectId, { operations }, token);
      setPendingOperations(result);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to preview operations');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleApply() {
    const operations = parseOperations();
    if (!operations || isApplying) return;

    setIsApplying(true);
    try {
      const token = await getToken();
      await workspaceService.applyBatch(projectId, { operations }, token);
      toast.success('Batch applied');
      setPendingOperations(null);
      setRaw('');
      onApplied();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to apply batch');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPendingOperations(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Batch Operations</DialogTitle>
          <DialogDescription>
            Mingo AI wants to make these changes. Preview before applying — nothing is written until
            you confirm.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder={PLACEHOLDER}
          rows={8}
          className="font-mono text-xs"
        />

        {pendingOperations && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border p-3">
            <ul className="flex flex-col gap-1.5">
              {pendingOperations.operations.map((entry, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Badge variant={ACTION_VARIANT[entry.action]}>{entry.action}</Badge>
                  <span className="truncate font-mono text-xs">
                    {entry.path}
                    {entry.destinationPath ? ` → ${entry.destinationPath}` : ''}
                  </span>
                </li>
              ))}
            </ul>

            {pendingOperations.conflicts.length + pendingOperations.errors.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 text-xs text-destructive">
                {[...pendingOperations.errors, ...pendingOperations.conflicts].map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}

            {pendingOperations.warnings.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 text-xs text-amber-600">
                {pendingOperations.warnings.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void handlePreview()} disabled={!raw.trim() || isPreviewing}>
            Preview
          </Button>
          <Button
            onClick={() => void handleApply()}
            disabled={!pendingOperations?.valid || isApplying}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
