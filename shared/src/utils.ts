const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;
const MAX_PATH_LENGTH = 500;

/**
 * Collapses accidental duplicate slashes and trims a trailing one. Deliberately does NOT strip a
 * *leading* slash — doing so would silently turn an absolute path into a relative one before
 * `isValidRelativePath` ever gets to see (and reject) it. Never call this on untrusted input
 * without validating the result with `isValidRelativePath`.
 */
export function normalizeRelativePath(path: string): string {
  return path.trim().replace(/\/+/g, '/').replace(/\/+$/, '');
}

/**
 * True only for a safe, project-relative workspace path: no `..` segments, no leading `/`,
 * no backslashes, no Windows drive letters, no null bytes. The workspace filesystem is entirely
 * MongoDB-backed (see `ProjectFile`) — this is what keeps a stored `path` from ever being able to
 * reference anything outside the project's own document set.
 */
export function isValidRelativePath(path: string): boolean {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  if (path.includes('\0')) return false;
  if (path.includes('\\')) return false;
  if (path.startsWith('/')) return false;
  if (WINDOWS_DRIVE_PATTERN.test(path)) return false;

  const segments = path.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  h: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  svg: 'xml',
  sh: 'shell',
  bash: 'shell',
};

/** Maps a filename to a Monaco language id. Falls back to `plaintext` for anything unknown. */
export function detectLanguage(filename: string): string {
  const base = filename.split('/').pop() ?? filename;

  if (base.startsWith('.env')) return 'shell';
  if (base === 'Dockerfile') return 'dockerfile';

  const dotIndex = base.lastIndexOf('.');
  if (dotIndex <= 0) return 'plaintext';

  const ext = base.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] ?? 'plaintext';
}
