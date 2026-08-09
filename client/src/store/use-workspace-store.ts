import { create } from 'zustand';
import type { IOperationPreviewResult, IWorkspaceActivity, IWorkspaceManifest, IWorkspaceSnapshot } from 'shared';

/**
 * Richer than the backend's `WorkspaceStatus` enum (ready/saving/error/archived/initializing) —
 * this also reflects client-only states (unsaved edits, a save conflict, a restore/snapshot in
 * flight) so the header badge (spec §43) has one place to read from.
 */
export type WorkspaceUiStatus =
  | 'ready'
  | 'saving'
  | 'unsaved'
  | 'conflict'
  | 'error'
  | 'restoring'
  | 'snapshotting';

interface ActivityPage {
  items: IWorkspaceActivity[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Holds server-derived workspace state (manifest, snapshots, activity, a pending batch preview) —
 * deliberately separate from `use-workspace-ui-store.ts` (persisted UI prefs) and
 * `use-file-cache-store.ts` (open file buffers). Never stores full file content, and is never
 * persisted — it's a read cache of what the API returned, not a source of truth (spec §37).
 */
interface WorkspaceState {
  status: WorkspaceUiStatus;
  manifest: IWorkspaceManifest | null;
  snapshots: IWorkspaceSnapshot[];
  activity: IWorkspaceActivity[];
  activityCursor: string | null;
  activityHasMore: boolean;
  pendingOperations: IOperationPreviewResult | null;

  setStatus: (status: WorkspaceUiStatus) => void;
  setManifest: (manifest: IWorkspaceManifest | null) => void;
  setSnapshots: (snapshots: IWorkspaceSnapshot[]) => void;
  addSnapshot: (snapshot: IWorkspaceSnapshot) => void;
  setActivityPage: (page: ActivityPage, append?: boolean) => void;
  setPendingOperations: (result: IOperationPreviewResult | null) => void;
  reset: () => void;
}

const initialState = {
  status: 'ready' as WorkspaceUiStatus,
  manifest: null,
  snapshots: [],
  activity: [],
  activityCursor: null,
  activityHasMore: false,
  pendingOperations: null,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setManifest: (manifest) => set({ manifest }),
  setSnapshots: (snapshots) => set({ snapshots }),
  addSnapshot: (snapshot) => set((state) => ({ snapshots: [snapshot, ...state.snapshots] })),
  setActivityPage: (page, append = false) =>
    set((state) => ({
      activity: append ? [...state.activity, ...page.items] : page.items,
      activityCursor: page.nextCursor,
      activityHasMore: page.hasMore,
    })),
  setPendingOperations: (result) => set({ pendingOperations: result }),
  reset: () => set(initialState),
}));
