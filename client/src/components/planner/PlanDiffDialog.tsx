import type { IPlanDiff } from 'shared';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PlanDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: IPlanDiff | null;
}

function DiffLine({ symbol, className, children }: { symbol: string; className: string; children: React.ReactNode }) {
  return (
    <p className={`flex items-start gap-2 font-mono text-sm ${className}`}>
      <span className="w-4 shrink-0">{symbol}</span>
      <span className="font-sans">{children}</span>
    </p>
  );
}

/** A plain structural diff (spec §54) — added/removed/changed by id, not a text/line diff. */
export function PlanDiffDialog({ open, onOpenChange, diff }: PlanDiffDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>What changed in this regeneration</DialogTitle>
          <DialogDescription>Compared to the previous plan version.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-1.5 pr-3">
            {diff?.featuresAdded.map((f) => (
              <DiffLine key={`fa-${f.id}`} symbol="+" className="text-emerald-500">
                Added feature &ldquo;{f.name}&rdquo;
              </DiffLine>
            ))}
            {diff?.featuresRemoved.map((f) => (
              <DiffLine key={`fr-${f.id}`} symbol="-" className="text-destructive">
                Removed feature &ldquo;{f.name}&rdquo;
              </DiffLine>
            ))}
            {diff?.featuresChanged.map((c) => (
              <DiffLine key={`fc-${c.after.id}`} symbol="~" className="text-amber-500">
                Changed feature &ldquo;{c.after.name}&rdquo;
              </DiffLine>
            ))}
            {diff?.tasksAdded.map((t) => (
              <DiffLine key={`ta-${t.id}`} symbol="+" className="text-emerald-500">
                Added task {t.id}: {t.title}
              </DiffLine>
            ))}
            {diff?.tasksRemoved.map((t) => (
              <DiffLine key={`tr-${t.id}`} symbol="-" className="text-destructive">
                Removed task {t.id}: {t.title}
              </DiffLine>
            ))}
            {diff?.tasksChanged.map((c) => (
              <DiffLine key={`tc-${c.after.id}`} symbol="~" className="text-amber-500">
                Changed task {c.after.id}: {c.after.title}
              </DiffLine>
            ))}
            {diff?.stackChanged.map((s) => (
              <DiffLine key={`sc-${s.key}`} symbol="~" className="text-amber-500">
                Changed {s.key} from &ldquo;{s.before?.name ?? 'none'}&rdquo; to &ldquo;{s.after?.name ?? 'none'}&rdquo;
              </DiffLine>
            ))}

            {diff &&
              diff.featuresAdded.length === 0 &&
              diff.featuresRemoved.length === 0 &&
              diff.featuresChanged.length === 0 &&
              diff.tasksAdded.length === 0 &&
              diff.tasksRemoved.length === 0 &&
              diff.tasksChanged.length === 0 &&
              diff.stackChanged.length === 0 && (
                <p className="text-sm text-muted-foreground">No structural changes detected.</p>
              )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
