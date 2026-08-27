import { EventEmitter } from 'node:events';
import { ISandboxEvent, SandboxEventType } from 'shared';

/**
 * In-process pub/sub for live sandbox/terminal events (Phase 11 spec §13/§65) — structurally identical
 * to `orchestrator/orchestrator.events.ts`. No persistence here beyond what
 * `sandbox.service.ts` already writes onto the `SandboxSession` document itself at each status
 * transition — a sandbox run is short-lived (one command), so there's no need for the same capped
 * replay-buffer array the longer-lived `Workflow` keeps; a client that connects after the fact just
 * reads the finished `SandboxSession` document instead (`GET /sandbox/:id`).
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function channel(sandboxId: string): string {
  return `sandbox:${sandboxId}`;
}

export function subscribe(sandboxId: string, listener: (event: ISandboxEvent) => void): () => void {
  emitter.on(channel(sandboxId), listener);
  return () => emitter.off(channel(sandboxId), listener);
}

export function publish(sandboxId: string, partial: Omit<ISandboxEvent, 'sandboxId' | 'timestamp'>): ISandboxEvent {
  const event: ISandboxEvent = { ...partial, sandboxId, timestamp: new Date().toISOString() };
  emitter.emit(channel(sandboxId), event);
  return event;
}

export function publishOutput(sandboxId: string, chunk: string, stream: 'stdout' | 'stderr'): void {
  publish(sandboxId, {
    type: stream === 'stdout' ? SandboxEventType.TERMINAL_OUTPUT : SandboxEventType.TERMINAL_ERROR,
    message: stream === 'stdout' ? 'output' : 'error output',
    chunk,
  });
}
