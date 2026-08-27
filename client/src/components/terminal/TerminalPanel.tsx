'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Loader2, Square, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SandboxStatus } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import * as sandboxService from '@/services/sandbox.service';
import { useSandboxStore } from '@/store/use-sandbox-store';
import type { SandboxStreamEvent } from '@/types/sandbox';

interface TerminalPanelProps {
  projectId: string;
  onClose?: () => void;
}

const STATUS_VARIANT: Record<SandboxStatus, 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  [SandboxStatus.CREATING]: 'outline',
  [SandboxStatus.STARTING]: 'outline',
  [SandboxStatus.READY]: 'outline',
  [SandboxStatus.RUNNING]: 'warning',
  [SandboxStatus.COMPLETED]: 'success',
  [SandboxStatus.FAILED]: 'destructive',
  [SandboxStatus.TIMEOUT]: 'destructive',
  [SandboxStatus.CANCELLED]: 'secondary',
  [SandboxStatus.DESTROYING]: 'secondary',
  [SandboxStatus.DESTROYED]: 'secondary',
};

const TERMINAL_EXIT_TYPES = new Set(['terminal:exit', 'terminal:timeout', 'terminal:cancelled']);

/**
 * Secure terminal panel (Phase 11 spec §12/§74) — every command runs through the Docker-based
 * SandboxManager, never on the Mingo host. A plain scrolling output view, not a full VT100 emulator:
 * the spec's own UI mockup is plain output lines, so `xterm.js` isn't a dependency this needs.
 */
export function TerminalPanel({ projectId, onClose }: TerminalPanelProps) {
  const { getToken } = useAuth();

  const entries = useSandboxStore((state) => state.entries);
  const isRunning = useSandboxStore((state) => state.isRunning);
  const streamError = useSandboxStore((state) => state.streamError);
  const startEntry = useSandboxStore((state) => state.startEntry);
  const appendOutput = useSandboxStore((state) => state.appendOutput);
  const finishEntry = useSandboxStore((state) => state.finishEntry);
  const setStreamError = useSandboxStore((state) => state.setStreamError);
  const clear = useSandboxStore((state) => state.clear);
  const reset = useSandboxStore((state) => state.reset);

  const [input, setInput] = useState('');
  const [activeSandboxId, setActiveSandboxId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    reset();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  async function runCommand(commandLine: string) {
    const trimmed = commandLine.trim();
    if (!trimmed || isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setStreamError(null);

    try {
      const token = await getToken();
      const session = await sandboxService.createSandboxRun(projectId, { commandLine: trimmed }, token);
      setActiveSandboxId(session.id);
      startEntry(session.id, session.command, session.args);
      setInput('');

      const onEvent = (event: SandboxStreamEvent) => {
        if (event.chunk) {
          appendOutput(session.id, event.chunk);
          return;
        }

        if (TERMINAL_EXIT_TYPES.has(event.type)) {
          const status =
            event.type === 'terminal:timeout'
              ? SandboxStatus.TIMEOUT
              : event.type === 'terminal:cancelled'
                ? SandboxStatus.CANCELLED
                : event.exitCode === 0
                  ? SandboxStatus.COMPLETED
                  : SandboxStatus.FAILED;
          finishEntry(session.id, status, event.exitCode, status === SandboxStatus.FAILED ? event.message : undefined);
        }
      };

      await sandboxService.streamSandboxEvents(projectId, session.id, token, { signal: controller.signal, onEvent });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof ApiError ? error.message : 'Failed to run this command';
      setStreamError(message);
      toast.error(message);
      if (activeSandboxId) finishEntry(activeSandboxId, SandboxStatus.FAILED, undefined, message);
    } finally {
      setActiveSandboxId(null);
    }
  }

  async function handleStop() {
    if (!activeSandboxId) return;
    abortRef.current?.abort();
    try {
      const token = await getToken();
      await sandboxService.stopSandboxRun(projectId, activeSandboxId, token);
    } catch {
      // Best-effort — the client-side abort already stopped listening either way.
    }
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <TerminalIcon className="size-4" /> Terminal
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={clear} disabled={entries.length === 0}>
            <Trash2 className="size-3.5" /> Clear
          </Button>
          {isRunning && (
            <Button variant="outline" size="sm" onClick={() => void handleStop()}>
              <Square className="size-3.5" /> Stop
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-md bg-black/90 p-3 font-mono text-xs text-emerald-400"
      >
        {entries.length === 0 && (
          <p className="text-muted-foreground">
            Run npm/npx/node/git commands here — every command executes inside an isolated Docker
            sandbox, never on the host.
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.sandboxId} className="mb-3">
            <div className="flex items-center gap-2 text-foreground">
              <span className="text-primary">$</span>
              <span>{[entry.command, ...entry.args].join(' ')}</span>
              <Badge variant={STATUS_VARIANT[entry.status]} className="capitalize">
                {entry.status === SandboxStatus.RUNNING ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  entry.status
                )}
              </Badge>
              {entry.exitCode !== undefined && (
                <span className="text-muted-foreground">exit {entry.exitCode}</span>
              )}
            </div>
            {entry.output && <pre className="whitespace-pre-wrap">{entry.output}</pre>}
            {entry.error && <p className="text-destructive">{entry.error}</p>}
          </div>
        ))}
      </div>

      {streamError && <p className="text-xs text-destructive">{streamError}</p>}

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void runCommand(input);
        }}
      >
        <span className="font-mono text-sm text-muted-foreground">$</span>
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="npm run build"
          disabled={isRunning}
          aria-label="Terminal command"
          className="font-mono"
        />
        <Button type="submit" size="sm" disabled={isRunning || !input.trim()}>
          {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : 'Run'}
        </Button>
      </form>
    </div>
  );
}
