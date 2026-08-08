import { create } from 'zustand';
import type { OpenFileState } from '@/types/workspace';

/**
 * In-memory cache of currently-open files, keyed by `${projectId}:${path}`.
 * Deliberately NOT persisted (no `zustand/persist`) — reloading the page re-fetches file content
 * from MongoDB rather than trusting stale localStorage content (spec section 29/42).
 */
interface FileCacheState {
  files: Record<string, OpenFileState>;
  setFile: (key: string, file: OpenFileState) => void;
  updateFile: (key: string, patch: Partial<OpenFileState>) => void;
  removeFile: (key: string) => void;
  removeMatching: (predicate: (key: string) => boolean) => void;
}

export const useFileCacheStore = create<FileCacheState>((set) => ({
  files: {},
  setFile: (key, file) => set((state) => ({ files: { ...state.files, [key]: file } })),
  updateFile: (key, patch) =>
    set((state) => {
      const existing = state.files[key];
      if (!existing) return state;
      return { files: { ...state.files, [key]: { ...existing, ...patch } } };
    }),
  removeFile: (key) =>
    set((state) => {
      const next = { ...state.files };
      delete next[key];
      return { files: next };
    }),
  removeMatching: (predicate) =>
    set((state) => {
      const next: Record<string, OpenFileState> = {};
      for (const [key, value] of Object.entries(state.files)) {
        if (!predicate(key)) next[key] = value;
      }
      return { files: next };
    }),
}));

export function fileCacheKey(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}
