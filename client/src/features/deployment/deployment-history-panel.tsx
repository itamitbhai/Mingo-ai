'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DeploymentEnvironment, DeploymentStatus } from 'shared';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { listDeploymentHistory, rollbackDeployment } from '@/services/deployment.service';
import type { IDeployment } from '@/types/deployment';
import { formatDate } from '@/utils/format';

const STATUS_VARIANT: Record<DeploymentStatus, 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  [DeploymentStatus.QUEUED]: 'outline',
  [DeploymentStatus.PENDING]: 'outline',
  [DeploymentStatus.RUNNING]: 'warning',
  [DeploymentStatus.BUILDING]: 'warning',
  [DeploymentStatus.SUCCESS]: 'success',
  [DeploymentStatus.FAILED]: 'destructive',
  [DeploymentStatus.CANCELLED]: 'secondary',
  [DeploymentStatus.ROLLED_BACK]: 'secondary',
};

const PAGE_SIZE = 10;

export function DeploymentHistoryPanel({ projectId, environment }: { projectId: string; environment: DeploymentEnvironment }) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<IDeployment[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rollbackTarget, setRollbackTarget] = useState<IDeployment | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const token = await getToken();
        const result = await listDeploymentHistory(token, projectId, { environment, page: targetPage, limit: PAGE_SIZE });
        setItems(result.items);
        setPages(result.pagination.pages || 1);
        setPage(targetPage);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'Failed to load deployment history');
      } finally {
        setLoading(false);
      }
    },
    [projectId, environment, getToken]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    try {
      const token = await getToken();
      await rollbackDeployment(token, projectId, rollbackTarget.id);
      toast.success('Rollback started');
      setRollbackTarget(null);
      await load(1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to start rollback');
    } finally {
      setRollingBack(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
        No deployments to {environment} yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border/60 rounded-lg border border-border/60">
        {items.map((deployment) => (
          <div key={deployment.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <Badge variant={STATUS_VARIANT[deployment.status]} className="capitalize">
                {deployment.status.replace('_', ' ')}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{deployment.branch}</span>
              {deployment.commitHash && (
                <span className="font-mono text-xs text-muted-foreground">{deployment.commitHash.slice(0, 7)}</span>
              )}
              {deployment.pullRequestNumber ? (
                <Badge variant="outline" className="text-[10px]">
                  PR #{deployment.pullRequestNumber}
                </Badge>
              ) : deployment.triggeredBy === 'webhook' ? (
                <Badge variant="outline" className="text-[10px]">
                  Auto-deployed
                </Badge>
              ) : deployment.triggeredBy === 'rollback' ? (
                <Badge variant="outline" className="text-[10px]">
                  Rollback
                </Badge>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{formatDate(deployment.createdAt)}</span>
              {deployment.url && deployment.status === DeploymentStatus.SUCCESS && (
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open <ExternalLink className="size-3" />
                </a>
              )}
              {deployment.status === DeploymentStatus.SUCCESS && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setRollbackTarget(deployment)}>
                  <RotateCcw className="size-3.5" /> Rollback
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => void load(page + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={Boolean(rollbackTarget)} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back {environment}?</AlertDialogTitle>
            <AlertDialogDescription>
              This redeploys commit {rollbackTarget?.commitHash?.slice(0, 7)} on branch{' '}
              {rollbackTarget?.branch} exactly as it was — no local rebuild, no changes from your
              current workspace. This creates a new deployment; existing history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRollback()} disabled={rollingBack}>
              {rollingBack && <Loader2 className="size-4 animate-spin" />}
              Roll back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
