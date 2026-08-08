import { isValidRelativePath, normalizeRelativePath } from 'shared';
import { ApiError } from '../../utils/ApiError';

/** Re-validates a path server-side even though the zod route schema already normalized/validated
 *  it — the workspace "filesystem" is entirely MongoDB-backed, so this is the only thing standing
 *  between a crafted `path` and an out-of-scope query. */
export function assertSafePath(path: string): string {
  const normalized = normalizeRelativePath(path);

  if (!isValidRelativePath(normalized)) {
    throw ApiError.badRequest('Invalid file path');
  }

  return normalized;
}

export function getParentPath(path: string): string | null {
  const index = path.lastIndexOf('/');
  return index === -1 ? null : path.slice(0, index);
}

export function getBaseName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
