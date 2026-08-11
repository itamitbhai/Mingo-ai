'use client';

import { useState } from 'react';
import type { IAgentGeneration } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChangeFileList } from './ChangeFileList';

interface GenerationHistoryProps {
  generations: IAgentGeneration[];
}

/** Read-only history of every generation attempt for a task (spec §50) — regenerating never
 *  overwrites a previous proposal, it only adds a new version. */
export function GenerationHistory({ generations }: GenerationHistoryProps) {
  const [viewing, setViewing] = useState<IAgentGeneration | null>(null);

  if (generations.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generation history</h4>
      <div className="flex flex-col gap-1">
        {generations.map((generation) => (
          <div
            key={generation.id}
            className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 px-2.5 py-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono">v{generation.version}</span>
              <Badge variant="outline" className="capitalize">
                {generation.status.replace('_', ' ')}
              </Badge>
              {generation.feedback && (
                <span className="text-muted-foreground">&ldquo;{generation.feedback}&rdquo;</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setViewing(generation)}>
              View
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generation v{viewing?.version}</DialogTitle>
          </DialogHeader>
          {viewing && <ChangeFileList operations={viewing.operations} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
