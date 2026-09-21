'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { type DeploymentEnvironment } from 'shared';

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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import {
  createEnvironmentVariable,
  deleteEnvironmentVariable,
  listEnvironmentVariables,
  revealEnvironmentVariable,
} from '@/services/deployment.service';
import type { IEnvironmentVariable } from '@/types/deployment';

export function EnvironmentVariablesPanel({
  projectId,
  environment,
}: {
  projectId: string;
  environment: DeploymentEnvironment;
}) {
  const { getToken } = useAuth();
  const [variables, setVariables] = useState<IEnvironmentVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IEnvironmentVariable | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const result = await listEnvironmentVariables(token, projectId, environment);
      setVariables(result);
      setRevealed({});
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load environment variables');
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId, environment]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleReveal = async (variable: IEnvironmentVariable) => {
    if (revealed[variable.id] !== undefined) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[variable.id];
        return next;
      });
      return;
    }

    setRevealingId(variable.id);
    try {
      const token = await getToken();
      const result = await revealEnvironmentVariable(token, projectId, variable.id);
      setRevealed((prev) => ({ ...prev, [variable.id]: result.value }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to reveal value');
    } finally {
      setRevealingId(null);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      await createEnvironmentVariable(token, projectId, { environment, key: newKey.trim(), value: newValue });
      toast.success(`"${newKey.trim()}" added`);
      setAddOpen(false);
      setNewKey('');
      setNewValue('');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to add environment variable');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const token = await getToken();
      await deleteEnvironmentVariable(token, projectId, deleteTarget.id);
      toast.success(`"${deleteTarget.key}" deleted`);
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete environment variable');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Environment Variables</h3>
          <p className="text-xs text-muted-foreground">
            Values are encrypted at rest and hidden by default — never logged, never sent to the AI, never
            included in generated code.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Variable
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : variables.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
          No environment variables configured for {environment} yet.
        </p>
      ) : (
        <div className="divide-y divide-border/60 rounded-lg border border-border/60">
          {variables.map((variable) => (
            <div key={variable.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{variable.key}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {revealed[variable.id] ?? variable.value}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => handleReveal(variable)}
                  disabled={revealingId === variable.id}
                  aria-label={revealed[variable.id] !== undefined ? 'Hide value' : 'Reveal value'}
                >
                  {revealingId === variable.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : revealed[variable.id] !== undefined ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(variable)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add environment variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="env-key">Key</Label>
              <Input
                id="env-key"
                placeholder="DATABASE_URL"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="env-value">Value</Label>
              <Input
                id="env-value"
                type="password"
                placeholder="••••••••"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving || !newKey.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.key}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from {environment} deployments. Existing running deployments keep using
              whatever value they were already started with.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
