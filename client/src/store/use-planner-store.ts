import { create } from 'zustand';
import type { IPlanDiff, IProjectPlan } from 'shared';
import type { PlannerStage } from '@/types/planner';

export type PlannerRunStatus = 'idle' | 'streaming' | 'error';

interface PendingDiff {
  previousPlan: IProjectPlan;
  diff: IPlanDiff;
}

/** Non-persisted — mirrors `use-workspace-store.ts`'s pattern of holding server-derived state
 *  separately from any UI-preference store. Never stores more than the current/latest plan and a
 *  page of history, never the full plan corpus for a project. */
interface PlannerState {
  runStatus: PlannerRunStatus;
  stage: PlannerStage | null;
  stageLabel: string;
  streamError: string | null;

  currentPlan: IProjectPlan | null;
  planHistory: IProjectPlan[];
  pendingDiff: PendingDiff | null;

  startRun: () => void;
  setStage: (stage: PlannerStage, label: string) => void;
  finishRun: (plan: IProjectPlan) => void;
  failRun: (message: string) => void;
  setCurrentPlan: (plan: IProjectPlan | null) => void;
  setPlanHistory: (plans: IProjectPlan[]) => void;
  setPendingDiff: (diff: PendingDiff | null) => void;
  reset: () => void;
}

const initialState = {
  runStatus: 'idle' as PlannerRunStatus,
  stage: null,
  stageLabel: '',
  streamError: null,
  currentPlan: null,
  planHistory: [],
  pendingDiff: null,
};

export const usePlannerStore = create<PlannerState>((set) => ({
  ...initialState,

  startRun: () => set({ runStatus: 'streaming', streamError: null, stage: 'loading_context', stageLabel: 'Loading project context…' }),
  setStage: (stage, label) => set({ stage, stageLabel: label }),
  finishRun: (plan) => set({ runStatus: 'idle', stage: 'done', currentPlan: plan }),
  failRun: (message) => set({ runStatus: 'error', stage: 'error', streamError: message }),
  setCurrentPlan: (plan) => set({ currentPlan: plan }),
  setPlanHistory: (plans) => set({ planHistory: plans }),
  setPendingDiff: (diff) => set({ pendingDiff: diff }),
  reset: () => set(initialState),
}));
