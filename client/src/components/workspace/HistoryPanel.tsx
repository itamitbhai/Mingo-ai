'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { IWorkspaceActivity } from 'shared';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api';
import * as workspaceService from '@/services/workspace/workspace.service';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface HistoryPanelProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'TODAY';
  if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function HistoryPanel({ projectId, open, onOpenChange }: HistoryPanelProps) {
  const { getToken } = useAuth();
  const activity = useWorkspaceStore((state) => state.activity);
  const hasMore = useWorkspaceStore((state) => state.activityHasMore);
  const cursor = useWorkspaceStore((state) => state.activityCursor);
  const setActivityPage = useWorkspaceStore((state) => state.setActivityPage);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load(pageCursor: string | null, append = false) {
    setIsLoading(true);
    try {
      const token = await getToken();
      const result = await workspaceService.getActivity(projectId, token, pageCursor);
      setActivityPage(result, append);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }

  const groups = useMemo(() => {
    const byDay = new Map<string, IWorkspaceActivity[]>();
    for (const entry of activity) {
      const label = dayLabel(entry.createdAt);
      byDay.set(label, [...(byDay.get(label) ?? []), entry]);
    }
    return Array.from(byDay.entries());
  }, [activity]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Workspace History</SheetTitle>
          <SheetDescription>Every change made in this workspace, most recent first.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading && activity.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Loading…</p>
          )}
          {!isLoading && activity.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
          )}

          {groups.map(([label, entries]) => (
            <div key={label} className="py-2">
              <p className="px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground">{label}</p>
              <ul className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                    <p>{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {hasMore && (
            <div className="py-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isLoading}
                onClick={() => void load(cursor, true)}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
