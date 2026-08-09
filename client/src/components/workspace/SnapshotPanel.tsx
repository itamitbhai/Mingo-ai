'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { IWorkspaceSnapshot } from 'shared';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import * as workspaceService from '@/services/workspace/workspace.service';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface SnapshotPanelProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}

export function SnapshotPanel({ projectId, open, onOpenChange, onRestored }: SnapshotPanelProps) {
  const { getToken } = useAuth();
  const snapshots = useWorkspaceStore((state) => state.snapshots);
  const setSnapshots = useWorkspaceStore((state) => state.setSnapshots);
  const addSnapshot = useWorkspaceStore((state) => state.addSnapshot);
  const setStatus = useWorkspaceStore((state) => state.setStatus);

  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<IWorkspaceSnapshot | null>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function refresh() {
    setIsLoading(true);
    try {
      const token = await getToken();
      const result = await workspaceService.listSnapshots(projectId, token);
      setSnapshots(result.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load snapshots');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    setStatus('snapshotting');
    try {
      const token = await getToken();
      const snapshot = await workspaceService.createSnapshot(
        projectId,
        { name: trimmed, description: description.trim() || undefined },
        token
      );
      addSnapshot(snapshot);
      setName('');
      setDescription('');
      toast.success('Snapshot created');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create snapshot');
    } finally {
      setIsCreating(false);
      setStatus('ready');
    }
  }

  async function handleRestore() {
    if (!restoreTarget || isRestoring) return;

    setIsRestoring(true);
    setStatus('restoring');
    try {
      const token = await getToken();
      await workspaceService.restoreSnapshot(projectId, restoreTarget.id, token);
      toast.success(`Restored "${restoreTarget.name}"`);
      setRestoreTarget(null);
      await refresh();
      onRestored();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to restore snapshot');
    } finally {
      setIsRestoring(false);
      setStatus('ready');
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Workspace Snapshots</SheetTitle>
            <SheetDescription>Save and restore points in your project&apos;s history.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 border-b border-border px-4 pb-4">
            <Input
              placeholder="Snapshot name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Snapshot name"
            />
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              aria-label="Snapshot description"
            />
            <Button onClick={() => void handleCreate()} disabled={!name.trim() || isCreating} size="sm">
              Create Snapshot
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {isLoading && <p className="py-4 text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && snapshots.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No snapshots yet.</p>
            )}
            <ul className="flex flex-col gap-2 py-3">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{snapshot.name}</span>
                    <Button variant="outline" size="sm" onClick={() => setRestoreTarget(snapshot)}>
                      Restore
                    </Button>
                  </div>
                  {snapshot.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{snapshot.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.fileCount} files
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore &ldquo;{restoreTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Current workspace will be backed up automatically before restoring. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRestore()} disabled={isRestoring}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
