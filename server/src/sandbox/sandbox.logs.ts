import { sandboxConfig } from './sandbox.config';

export interface SandboxLogsField {
  stdout: string;
  stderr: string;
  truncated: boolean;
}

/** Final, defensive re-cap before persisting (spec §50) — `sandbox.executor.ts`'s collectors already
 *  cap in real time as output streams in; this just guarantees the persisted document never exceeds
 *  the configured limit regardless of how the text arrived. */
export function buildLogsField(stdout: string, stderr: string, truncated: boolean): SandboxLogsField {
  return {
    stdout: stdout.slice(-sandboxConfig.MAX_LOG_CHARS),
    stderr: stderr.slice(-sandboxConfig.MAX_LOG_CHARS),
    truncated,
  };
}
