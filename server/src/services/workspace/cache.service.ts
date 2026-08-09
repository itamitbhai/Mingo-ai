import { workspaceConfig } from '../../config/workspace.config';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory get/set/invalidate/clear cache, keyed by an arbitrary string (typically
 * `${projectId}:tree` or `${projectId}:manifest`). MongoDB stays the source of truth — this is a
 * read-through convenience layer, never authoritative, and is written behind this small interface
 * so a Redis-backed implementation can replace it later without touching call sites (spec §36).
 */
class WorkspaceCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = workspaceConfig.CACHE_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Drops every cached entry for a project (called after any mutating workspace operation). */
  invalidate(projectId: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const workspaceCache = new WorkspaceCache();
