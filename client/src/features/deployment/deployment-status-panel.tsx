'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertTriangle, ExternalLink, Loader2, Rocket, Square } from 'lucide-react';
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
import * as deploymentService from '@/services/deployment.service';
import type { IDeployment, IDeploymentReadiness, IDeploymentStreamEvent } from '@/types/deployment';

const NON_TERMINAL_STATUSES: DeploymentStatus[] = [
  DeploymentStatus.QUEUED,
  DeploymentStatus.PENDING,
  DeploymentStatus.RUNNING,
  DeploymentStatus.BUILDING,
];

const STATUS_BADGE: Record<DeploymentStatus, { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  [DeploymentStatus.QUEUED]: { label: 'Queued', variant: 'outline' },
  [DeploymentStatus.PENDING]: { label: 'Queued', variant: 'outline' },
  [DeploymentStatus.RUNNING]: { label: 'Deploying', variant: 'warning' },
  [DeploymentStatus.BUILDING]: { label: 'Building', variant: 'warning' },
  [DeploymentStatus.SUCCESS]: { label: 'Live', variant: 'success' },
  [DeploymentStatus.FAILED]: { label: 'Failed', variant: 'destructive' },
  [DeploymentStatus.CANCELLED]: { label: 'Cancelled', variant: 'secondary' },
  [DeploymentStatus.ROLLED_BACK]: { label: 'Rolled back', variant: 'secondary' },
};

export function DeploymentStatusPanel({ projectId, environment }: { projectId: string; environment: DeploymentEnvironment }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<IDeploymentReadiness | null>(null);
  const [deployment, setDeployment] = useState<IDeployment | null>(null);
  const [liveLog, setLiveLog] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dirtyWarning, setDirtyWarning] = useState<{ message: string; files: string[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = deployment ? NON_TERMINAL_STATUSES.includes(deployment.status) : false;

  const followStream = useCallback(
    async (deploymentId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLiveLog('');

      const onEvent = (event: IDeploymentStreamEvent) => {
        if (event.chunk) {
          setLiveLog((prev) => (prev + event.chunk).slice(-20000));
        }
        setDeployment((prev) => (prev ? { ...prev, stage: event.stage ?? prev.stage } : prev));

        if (event.type === 'deployment:success' || event.type === 'deployment:failed' || event.type === 'deployment:cancelled') {
          void refresh();
        }
      };

      try {
        const token = await getToken();
        await deploymentService.streamDeploymentEvents(projectId, deploymentId, token, {
          signal: controller.signal,
          onEvent,
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(error instanceof ApiError ? error.message : 'Lost connection to the deployment log stream');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, getToken]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [readinessResult, historyResult] = await Promise.all([
        deploymentService.validateDeployment(token, projectId, { environment, allowDirty: false }),
        deploymentService.listDeploymentHistory(token, projectId, { environment, limit: 1 }),
      ]);
      setReadiness(readinessResult);
      const latest = historyResult.items[0] ?? null;
      setDeployment(latest);

      if (latest && NON_TERMINAL_STATUSES.includes(latest.status)) {
        void followStream(latest.id);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load deployment status');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, environment, getToken]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, environment]);

  const runDeploy = async (allowDirty: boolean) => {
    setDeploying(true);
    setDirtyWarning(null);
    try {
      const token = await getToken();
      const created = await deploymentService.createDeployment(token, projectId, { environment, allowDirty });
      setDeployment(created);
      toast.success('Deployment started');
      void followStream(created.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.errors?.files) {
        setDirtyWarning({ message: error.message, files: error.errors.files });
      } else {
        toast.error(error instanceof ApiError ? error.message : 'Failed to start deployment');
      }
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployClick = () => {
    if (environment === DeploymentEnvironment.PRODUCTION) {
      setConfirmOpen(true);
      return;
    }
    void runDeploy(false);
  };

  const handleCancel = async () => {
    if (!deployment) return;
    try {
      const token = await getToken();
      await deploymentService.cancelDeployment(token, projectId, deployment.id);
      toast.info('Cancelling deployment…');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to cancel deployment');
    }
  };

  if (loading && !deployment) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const badge = deployment ? STATUS_BADGE[deployment.status] : { label: 'Offline', variant: 'secondary' as const };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant} className="gap-1.5">
            <span className="size-1.5 rounded-full bg-current" />
            {badge.label}
            {deployment?.stage && isRunning && <span className="opacity-70">· {deployment.stage.replace('_', ' ')}</span>}
          </Badge>
          {deployment?.commitHash && (
            <span className="font-mono text-xs text-muted-foreground">{deployment.commitHash.slice(0, 7)}</span>
          )}
          {deployment?.url && deployment.status === DeploymentStatus.SUCCESS && (
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open Application <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="outline" size="sm" onClick={() => void handleCancel()}>
              <Square className="size-4" /> Cancel
            </Button>
          ) : (
            <Button size="sm" onClick={handleDeployClick} disabled={deploying || !readiness?.ready}>
              {deploying ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Deploy
            </Button>
          )}
        </div>
      </div>

      {readiness && (
        <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
          {readiness.checks.map((check) => (
            <li key={check.label} className="flex items-center gap-1.5">
              <span className={check.passed ? 'text-emerald-500' : check.blocking ? 'text-destructive' : 'text-amber-500'}>
                {check.passed ? '✓' : check.blocking ? '✗' : '!'}
              </span>
              <span className={check.passed ? 'text-muted-foreground' : ''}>{check.label}</span>
              {check.detail && <span className="truncate text-muted-foreground/70">— {check.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {deployment?.status === DeploymentStatus.FAILED && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" /> Deployment failed{deployment.stage ? ` at "${deployment.stage}"` : ''}
          </p>
          {deployment.error && <p className="mt-1 text-xs text-muted-foreground">{deployment.error}</p>}
        </div>
      )}

      {(isRunning || liveLog) && (
        <div className="max-h-64 overflow-y-auto rounded-md bg-black/90 p-3 font-mono text-xs text-emerald-400">
          {liveLog ? <pre className="whitespace-pre-wrap">{liveLog}</pre> : <p className="text-muted-foreground">Waiting for output…</p>}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deploy to Production?</AlertDialogTitle>
            <AlertDialogDescription>
              This deploys {deployment?.branch ?? 'the configured branch'} to your live production
              environment. This action cannot be silently undone — a rollback would be a new
              deployment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void runDeploy(false);
              }}
            >
              Deploy to Production
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(dirtyWarning)} onOpenChange={(open) => !open && setDirtyWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uncommitted changes</AlertDialogTitle>
            <AlertDialogDescription>
              {dirtyWarning?.message}
              {dirtyWarning?.files && dirtyWarning.files.length > 0 && (
                <span className="mt-2 block max-h-32 overflow-y-auto rounded bg-muted p-2 font-mono text-xs">
                  {dirtyWarning.files.join('\n')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runDeploy(true)}>Deploy Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
