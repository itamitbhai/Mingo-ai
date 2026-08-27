/**
 * Shared types for the Docker-based sandbox engine (Phase 11). `sandbox.manager.ts` is the only
 * module other code should call into directly — everything else here is internal wiring between its
 * own sub-modules.
 */

export type SandboxNetworkMode = 'none' | 'install';

export interface SandboxCommand {
  /** One of `sandbox.security.ts`'s allowlisted binaries — never a shell string. */
  command: string;
  args: string[];
}

export interface RunInContainerOptions extends SandboxCommand {
  /** Absolute host path bind-mounted at `/workspace` inside the container. */
  workspaceDir: string;
  /** Owning project — used to name the persistent `node_modules` volume (see `sandbox.executor.ts`)
   *  so packages installed by one command are still there for the next one. */
  projectId: string;
  /** Relative path under `/workspace` to run the command from (e.g. `"server"` for a monorepo-style
   *  generated project) — defaults to `/workspace` itself when omitted. */
  workingDir?: string;
  networkMode: SandboxNetworkMode;
  timeoutMs: number;
  /** A stable id (the `SandboxSession`'s own id) used as the container name/label so cleanup and the
   *  orphan sweep can always find it again, and so cancellation can look it up by id alone. */
  sandboxId: string;
  signal?: AbortSignal;
  onOutput?: (chunk: string, stream: 'stdout' | 'stderr') => void;
}

export interface RunInContainerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  timedOut: boolean;
  cancelled: boolean;
  containerId?: string;
}
