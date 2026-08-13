import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import type { TestRunStage } from '@/types/test-run';

const STEPS: { stage: TestRunStage; label: string }[] = [
  { stage: 'preparing', label: 'Preparing test environment' },
  { stage: 'installing', label: 'Installing dependencies' },
  { stage: 'running', label: 'Running tests' },
  { stage: 'collecting', label: 'Collecting results' },
  { stage: 'completed', label: 'Completed' },
];

function stepIndex(stage: TestRunStage | null): number {
  if (!stage) return -1;
  if (stage === 'error') return -1;
  return STEPS.findIndex((s) => s.stage === stage);
}

interface TestRunProgressProps {
  stage: TestRunStage | null;
  stageLabel: string;
  error?: string | null;
}

/** Live stage checklist for a running test execution (spec §33) — only real backend stage
 *  transitions are shown, mirroring `AgentProgress.tsx`'s pattern for a different pipeline. */
export function TestRunProgress({ stage, stageLabel, error }: TestRunProgressProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <XCircle className="size-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const currentIndex = stepIndex(stage);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-3">
      {STEPS.map((step, index) => {
        const isDone = currentIndex > index || stage === 'completed';
        const isActive = currentIndex === index && stage !== 'completed';

        return (
          <div key={step.stage} className="flex items-center gap-2 text-sm">
            {isDone ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            ) : isActive ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={isDone || isActive ? 'text-foreground' : 'text-muted-foreground'}>
              {isActive ? stageLabel || step.label : step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
