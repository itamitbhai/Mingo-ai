'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';

import { GithubMarkIcon } from '@/components/shared/logo';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { disconnectGithub, getGithubAuthorizeUrl, getGithubStatus } from '@/services/github.service';
import type { IGitHubStatus } from '@/types/github';

/** Settings → Integrations → GitHub (Phase 12 spec §3/§26). Never touches a GitHub access token
 *  directly — the connect button redirects the browser to a Mingo backend endpoint that itself
 *  redirects to GitHub, and `getGithubStatus` only ever returns username/avatar/scope metadata. */
export function GithubIntegrationCard() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<IGitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const result = await getGithubStatus(token);
      setStatus(result);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load GitHub connection status');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const token = await getToken();
      const { authorizeUrl } = await getGithubAuthorizeUrl(token);
      window.location.href = authorizeUrl;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to start GitHub connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const token = await getToken();
      await disconnectGithub(token);
      toast.success('GitHub disconnected');
      setConfirmOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to disconnect GitHub');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GithubMarkIcon className="size-4" /> GitHub
        </CardTitle>
        <CardDescription>
          Connect your GitHub account to import repositories and sync commits, branches, and pull
          requests with your Mingo projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : status?.connected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={status.avatarUrl} alt={status.username} />
                <AvatarFallback>{status.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">@{status.username}</span>
                  <Badge variant="secondary" className="gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Connected
                  </Badge>
                </div>
                {status.email ? <p className="text-sm text-muted-foreground">{status.email}</p> : null}
              </div>
            </div>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={connecting}>
            <GithubMarkIcon className="size-4" /> {connecting ? 'Redirecting…' : 'Connect GitHub'}
          </Button>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
            <AlertDialogDescription>
              Mingo will no longer be able to access your GitHub repositories. Your Mingo projects
              and files are kept exactly as they are, and nothing on GitHub itself is deleted. You
              can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
