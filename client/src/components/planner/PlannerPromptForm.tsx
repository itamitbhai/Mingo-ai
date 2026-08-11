'use client';

import { useEffect, useState } from 'react';
import { Loader2, Rocket, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GENERATING_SUB_LABELS, type PlannerStage } from '@/types/planner';

const EXAMPLE_PROMPT =
  'Build an e-commerce website using React, Node.js, MongoDB, JWT authentication and Stripe payments. Use Tailwind CSS and make it responsive.';

interface PlannerPromptFormProps {
  onSubmit: (prompt: string) => void;
  isStreaming: boolean;
  stage: PlannerStage | null;
  stageLabel: string;
  error: string | null;
  /** When provided, renders a second "Build It Now" action that plans, approves, and builds the
   *  whole thing end-to-end — omit to keep this form to the manual "Generate Plan" flow only. */
  onBuildNow?: (prompt: string) => void;
  isBuilding?: boolean;
}

/**
 * The AI call itself is one non-streamed request — while the server's `generating` stage is
 * active, this cycles the spec's descriptive sub-labels as an indeterminate-progress animation,
 * not a claim of discrete backend completions (see docs/ARCHITECTURE.md).
 */
function useGeneratingSubLabel(active: boolean): string | null {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % GENERATING_SUB_LABELS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [active]);

  return active ? GENERATING_SUB_LABELS[index] : null;
}

export function PlannerPromptForm({
  onSubmit,
  isStreaming,
  stage,
  stageLabel,
  error,
  onBuildNow,
  isBuilding = false,
}: PlannerPromptFormProps) {
  const [prompt, setPrompt] = useState('');
  const subLabel = useGeneratingSubLabel(isStreaming && stage === 'generating');
  const busy = isStreaming || isBuilding;

  function handleSubmit() {
    const trimmed = prompt.trim();
    if (trimmed.length < 10 || busy) return;
    onSubmit(trimmed);
  }

  function handleBuildNow() {
    const trimmed = prompt.trim();
    if (trimmed.length < 10 || busy || !onBuildNow) return;
    onBuildNow(trimmed);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Describe what you want to build</h2>
      </div>

      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={EXAMPLE_PROMPT}
        rows={5}
        disabled={busy}
        aria-label="Project request"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-sm text-muted-foreground">
          {isStreaming && (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              {subLabel ?? stageLabel}
            </span>
          )}
          {!busy && error && <span className="text-destructive">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSubmit} disabled={prompt.trim().length < 10 || busy}>
            {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate Plan
          </Button>
          {onBuildNow && (
            <Button onClick={handleBuildNow} disabled={prompt.trim().length < 10 || busy}>
              {isBuilding ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Build It Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
