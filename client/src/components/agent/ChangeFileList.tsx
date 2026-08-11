'use client';

import { useState } from 'react';
import { detectLanguage, type IFrontendOperation } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DiffViewerDialog } from '@/components/workspace/DiffViewerDialog';

const OPERATION_LABEL: Record<IFrontendOperation['type'], { label: string; variant: 'success' | 'default' | 'destructive' | 'secondary' }> = {
  create: { label: 'CREATE', variant: 'success' },
  update: { label: 'MODIFY', variant: 'default' },
  delete: { label: 'DELETE', variant: 'destructive' },
  rename: { label: 'RENAME', variant: 'secondary' },
  move: { label: 'MOVE', variant: 'secondary' },
};

interface ChangeFileListProps {
  operations: IFrontendOperation[];
}

/** File change preview list (spec §23/§55) — each row shows the operation, target path, and the
 *  AI's stated reason, with a diff view backed by the existing (previously-unused)
 *  `DiffViewerDialog` from the Browser IDE. */
export function ChangeFileList({ operations }: ChangeFileListProps) {
  const [diffTarget, setDiffTarget] = useState<IFrontendOperation | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {operations.map((op, index) => {
        const meta = OPERATION_LABEL[op.type];
        const targetPath = op.type === 'rename' ? `${op.path} → ${op.newName}` : op.type === 'move' ? `${op.path} → ${op.destinationPath}` : op.path;
        const canDiff = op.type === 'create' || op.type === 'update' || op.type === 'delete';

        return (
          <div
            key={`${op.path}-${index}`}
            className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/40 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="font-mono text-xs">{targetPath}</span>
              </div>
              {canDiff && (
                <Button variant="ghost" size="sm" onClick={() => setDiffTarget(op)}>
                  View Diff
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{op.reason}</p>
          </div>
        );
      })}

      <DiffViewerDialog
        open={Boolean(diffTarget)}
        onOpenChange={(open) => !open && setDiffTarget(null)}
        title={diffTarget?.path ?? ''}
        originalLabel="Current"
        modifiedLabel={diffTarget?.type === 'delete' ? 'Deleted' : 'Proposed'}
        original={diffTarget?.originalContent ?? ''}
        modified={diffTarget?.type === 'delete' ? '' : (diffTarget?.content ?? '')}
        language={diffTarget ? detectLanguage(diffTarget.path) : 'plaintext'}
      />
    </div>
  );
}
