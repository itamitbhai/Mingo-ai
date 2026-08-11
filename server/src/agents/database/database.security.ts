/**
 * Secret/forbidden-file protection for the Database Agent only (Phase 8 spec §10/§30) — mirrors
 * `agents/backend/backend.security.ts` exactly. The AI may reference an env var's *name* (e.g.
 * `process.env.MONGO_URI`) but must never see or write its file or value — MongoDB URIs in
 * particular embed credentials directly in the connection string, so `.env*` protection here is
 * exactly as load-bearing as it is for the Backend Agent.
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
