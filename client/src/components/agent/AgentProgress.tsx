import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import type { FrontendAgentStage } from '@/types/frontend-agent';

const STEPS: { stage: FrontendAgentStage; label: string }[] = [
  { stage: 'loading_context', label: 'Reading workspace' },
  { stage: 'reading_files', label: 'Analyzing existing components' },
  { stage: 'planning', label: 'Planning changes' },
  { stage: 'generating', label: 'Generating code' },
  { stage: 'validating', label: 'Validating' },
  { stage: 'preview_ready', label: 'Review' },
];

function stepIndex(stage: FrontendAgentStage | null): number {
  if (!stage) return -1;
  if (stage === 'retrying') return STEPS.findIndex((s) => s.stage === 'generating');
  if (stage === 'done') return STEPS.length;
  if (stage === 'error') return -1;
  return STEPS.findIndex((s) => s.stage === stage);
}

interface AgentProgressProps {
  stage: FrontendAgentStage | null;
  stageLabel: string;
  error?: string | null;
}

/** Live stage checklist for a running Frontend Agent task (spec §52/§53) — only real backend
 *  stage transitions are shown, nothing fabricated. */
export function AgentProgress({ stage, stageLabel, error }: AgentProgressProps) {
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
        const isDone = currentIndex > index || stage === 'done';
        const isActive = currentIndex === index && stage !== 'done';

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
              {isActive && stage === 'retrying' ? stageLabel : step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
