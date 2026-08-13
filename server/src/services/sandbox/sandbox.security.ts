import { ApiError } from '../../utils/ApiError';

/**
 * Sandbox-level protection (Phase 9 §16/§17/§45) — distinct from `agents/testing/testing.security.ts`
 * (which gates AI-*generated* content). This file gates the execution engine itself: what ever reaches
 * the materialized temp directory, and what environment a spawned process ever sees. Same denylist
 * convention every agent's own `*.security.ts` already uses (duplicated per module rather than
 * shared, matching this codebase's existing pattern) — kept in sync with
 * `agents/database/database.security.ts` intentionally.
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

/** Env vars ever allowed to reach a spawned test process — deliberately excludes every secret the
 *  Mingo server itself holds (`MONGODB_URI`, `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, etc.). A generated
 *  test reading `process.env.MONGODB_URI` sees `undefined`, never a real credential — this is the
 *  concrete mechanism behind "never run against production" (spec §16/§45), by construction rather
 *  than by trying to detect and strip secrets after the fact. */
const ALLOWED_ENV_KEYS = [
  'PATH',
  'Path',
  'SystemRoot',
  'windir',
  'TEMP',
  'TMP',
  'APPDATA',
  'LOCALAPPDATA',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'ProgramData',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'USERPROFILE',
  'PATHEXT',
  'COMSPEC',
];

export function buildSandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const key of ALLOWED_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }

  // Forced regardless of anything upstream — a generated test/config file can never override these.
  env.NODE_ENV = 'test';
  env.CI = 'true';
  env.npm_config_audit = 'false';
  env.npm_config_fund = 'false';

  return env;
}

const PRODUCTION_LOOKING_PATTERNS = [/mongodb\+srv:\/\//i, /mongodb\.net/i];

/** Defense-in-depth: `buildSandboxEnv` should never produce a value matching these (it's an
 *  allowlist, not a filter), but this is the second, independent gate spec §45 asks for — a scan of
 *  the *outgoing* env right before a process is spawned. */
export function assertSafeEnv(env: NodeJS.ProcessEnv): void {
  for (const value of Object.values(env)) {
    if (!value) continue;
    if (PRODUCTION_LOOKING_PATTERNS.some((pattern) => pattern.test(value))) {
      throw ApiError.badRequest('Test execution blocked because database environment could not be verified.');
    }
  }
}
