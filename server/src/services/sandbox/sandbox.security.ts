/**
 * Materialization-time path protection (Phase 9 §16/§17/§45) — distinct from
 * `agents/testing/testing.security.ts` (which gates AI-*generated* content). This file gates what
 * ever reaches a sandbox's materialized temp directory in the first place. Same denylist convention
 * every agent's own `*.security.ts` already uses (duplicated per module rather than shared, matching
 * this codebase's existing pattern) — kept in sync with `agents/database/database.security.ts`
 * intentionally.
 *
 * Env-allowlisting and the production-database SSRF check moved to `server/src/sandbox/
 * sandbox.security.ts` in Phase 11, once command execution moved from a host `child_process` into a
 * Docker container with its own, stronger isolation (a real network boundary, not just an env
 * allowlist) — kept here as a single copy rather than two same-named `buildSandboxEnv` functions.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.[^/]*)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /(^|\/)credentials\.[^/]+$/i,
  /(^|\/)secrets\.[^/]+$/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
];

export function isForbiddenPath(path: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(path));
}
