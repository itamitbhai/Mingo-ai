/**
 * Secret/forbidden-file protection for the Backend Agent only (Phase 7 spec §10/§29/§45) — mirrors
 * `agents/frontend/frontend.security.ts` exactly. Phase 4's `assertSafePath`
 * (services/files/file-validation.service.ts) blocks path traversal but has no secrets blocklist by
 * design, since a human user can freely edit `.env` in the IDE. The Backend Agent gets the same
 * stricter rule the Frontend Agent has: it must never see or write these paths, regardless of what
 * it proposes — the AI may reference an env var's *name* (e.g. `process.env.MONGO_URI`) but never
 * its file or value.
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

export function filterForbiddenPaths(paths: string[]): string[] {
  return paths.filter((path) => !isForbiddenPath(path));
}
