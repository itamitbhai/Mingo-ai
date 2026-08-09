import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspaceCache } from './cache.service';

describe('workspaceCache', () => {
  beforeEach(() => {
    workspaceCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for a key that was never set', () => {
    expect(workspaceCache.get('p1:tree')).toBeUndefined();
  });

  it('returns the cached value before it expires', () => {
    workspaceCache.set('p1:tree', ['a.txt'], 1_000);
    expect(workspaceCache.get('p1:tree')).toEqual(['a.txt']);
  });

  it('expires entries after their TTL', () => {
    workspaceCache.set('p1:tree', ['a.txt'], 1_000);
    vi.advanceTimersByTime(1_001);
    expect(workspaceCache.get('p1:tree')).toBeUndefined();
  });

  it('invalidate only drops entries for the given project', () => {
    workspaceCache.set('p1:tree', ['a.txt'], 10_000);
    workspaceCache.set('p1:manifest', { files: 1 }, 10_000);
    workspaceCache.set('p2:tree', ['b.txt'], 10_000);

    workspaceCache.invalidate('p1');

    expect(workspaceCache.get('p1:tree')).toBeUndefined();
    expect(workspaceCache.get('p1:manifest')).toBeUndefined();
    expect(workspaceCache.get('p2:tree')).toEqual(['b.txt']);
  });

  it('clear drops everything', () => {
    workspaceCache.set('p1:tree', ['a.txt'], 10_000);
    workspaceCache.set('p2:tree', ['b.txt'], 10_000);

    workspaceCache.clear();

    expect(workspaceCache.get('p1:tree')).toBeUndefined();
    expect(workspaceCache.get('p2:tree')).toBeUndefined();
  });
});
