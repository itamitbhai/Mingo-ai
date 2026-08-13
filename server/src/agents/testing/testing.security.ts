/**
 * Secret/forbidden-file protection for the Testing Agent (Phase 9 spec §15/§18/§47/§48) — mirrors
 * `agents/database/database.security.ts` exactly for `isForbiddenPath`, plus `scanForSecrets` (spec
 * §47): AI-authored test/config file content must never contain a real-looking credential. Scoped to
 * content the Testing Agent itself proposes — not a scan of the whole pre-existing project, which may
 * legitimately contain innocuous placeholder-looking strings the Testing Agent had no part in writing.
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

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'generic API key', pattern: /\bsk-[a-zA-Z0-9]{20,}\b/ },
  { name: 'MongoDB connection string with embedded credentials', pattern: /mongodb(?:\+srv)?:\/\/[^:/\s"']+:[^@/\s"']+@/i },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'hardcoded password literal', pattern: /password\s*[:=]\s*['"][^'"\s]{6,}['"]/i },
  { name: 'JWT-shaped literal', pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/ },
];

/** Returns a human-readable issue per match — an empty array means the content looks clean. Feeds
 *  `testing.validator.ts`'s semantic checks, which turn any hit into a correction-prompt retry rather
 *  than a silent strip (spec §47: "If detected: Block execution"). */
export function scanForSecrets(content: string): string[] {
  const issues: string[] = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Content appears to contain a ${name} — never write real secrets into generated files`);
    }
  }

  return issues;
}
