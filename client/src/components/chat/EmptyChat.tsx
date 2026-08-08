'use client';

import { Database, MessageSquareCode, Rocket, ShieldCheck, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  { icon: ShieldCheck, label: 'Design the authentication architecture' },
  { icon: MessageSquareCode, label: 'How should I structure my backend?' },
  { icon: Database, label: 'Create a MongoDB schema for this project' },
  { icon: Rocket, label: 'How should I implement Stripe payments?' },
  { icon: Sparkles, label: 'Review my architecture' },
];

interface EmptyChatProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function EmptyChat({ onSelectPrompt, disabled }: EmptyChatProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="gradient-bg glow-primary flex size-14 items-center justify-center rounded-2xl">
        <Sparkles className="size-7 text-primary-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight">Mingo AI</h2>
        <p className="text-sm font-medium text-muted-foreground">Your AI Software Engineer</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Describe what you want to build, ask technical questions, or get help designing your
          application.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(label)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
