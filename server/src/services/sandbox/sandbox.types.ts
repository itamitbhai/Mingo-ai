/**
 * Types for materializing a project and detecting its test command (Phase 9 §2) — the actual command
 * *execution* now happens inside a Docker container (`server/src/sandbox/`, Phase 11), not here.
 * Nothing in `agents/testing/` reaches into these types directly except `testing.runner.ts`, which
 * orchestrates them into one `TestRun`.
 */

export interface MaterializedWorkspace {
  /** Absolute path to the ephemeral temp directory holding the materialized project. */
  dir: string;
  fileCount: number;
  /** Always call this in a `finally` — removes the temp directory recursively. */
  cleanup: () => Promise<void>;
}

export type DetectedFramework = 'jest' | 'vitest' | 'mocha' | 'unknown';

export interface DetectedTestCommand {
  /** Path (relative to the workspace root, `''` for the root itself) containing the `package.json`
   *  this command runs from — e.g. `''`, `'client'`, `'server'`. */
  cwd: string;
  /** Path to the `package.json` that declared this script, relative to the workspace root. */
  packageJsonPath: string;
  /** The exact `package.json` `scripts` key this command runs — always one of a fixed, hardcoded
   *  allowlist (`command.service.ts`'s `SCRIPT_PRIORITY`), never a name read from untrusted content. */
  script: string;
  framework: DetectedFramework;
}

/** A `DetectedTestCommand` narrowed to a single scope request — `extraArgs` carries a specific test
 *  file path when the scope targets one file (spec §42/§62's "run affected test only"). */
export type ScopedTestCommand = DetectedTestCommand & { extraArgs?: string[] };
