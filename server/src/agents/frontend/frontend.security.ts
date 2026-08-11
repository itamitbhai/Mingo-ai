/**
 * Secret/forbidden-file protection for the Frontend Agent only (spec §14/§61/§62) — Phase 4's
 * `assertSafePath` (services/files/file-validation.service.ts) blocks path traversal but has no
 * secrets blocklist by design, since a human user can freely edit `.env` in the IDE. The AI agent
 * gets a stricter rule: it must never see or write these paths, regardless of what it proposes.
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
