import { create } from 'zustand';
import type { IAutopilotTaskResult, IProjectPlan } from 'shared';
import type { AutopilotPhase, AutopilotStageStreamEvent, AutopilotTaskStage } from '@/types/autopilot';
import type { PlannerStage } from '@/types/planner';

export type AutopilotRunStatus = 'idle' | 'streaming' | 'error';

interface AutopilotCurrentTask {
  taskId: string;
  taskTitle: string;
  taskIndex: number;
  taskCount: number;
}

interface AutopilotResult {
  plan: IProjectPlan;
  tasks: IAutopilotTaskResult[];
  stoppedEarly: boolean;
}

/** Non-persisted — mirrors `use-planner-store.ts`/`use-frontend-agent-store.ts`'s pattern of
 *  holding server-derived state separately from any UI-preference store. */
interface AutopilotState {
  runStatus: AutopilotRunStatus;
  phase: AutopilotPhase | null;
  stage: AutopilotTaskStage | PlannerStage | null;
  stageLabel: string;
  currentTask: AutopilotCurrentTask | null;
  streamError: string | null;
  result: AutopilotResult | null;

  startRun: () => void;
  setStage: (event: AutopilotStageStreamEvent) => void;
  finishRun: (payload: AutopilotResult) => void;
  failRun: (message: string) => void;
  reset: () => void;
}

const initialState = {
  runStatus: 'idle' as AutopilotRunStatus,
  phase: null,
  stage: null,
  stageLabel: '',
  currentTask: null,
  streamError: null,
  result: null,
};

export const useAutopilotStore = create<AutopilotState>((set) => ({
  ...initialState,

  startRun: () =>
    set({
      runStatus: 'streaming',
      streamError: null,
      result: null,
      phase: 'planning',
      stage: 'loading_context',
      stageLabel: 'Loading project context…',
      currentTask: null,
    }),

  setStage: (event) =>
    set({
      phase: event.phase,
      stage: event.phase === 'approving' ? null : event.stage,
      stageLabel: event.label,
      currentTask:
        event.phase === 'task'
          ? { taskId: event.taskId, taskTitle: event.taskTitle, taskIndex: event.taskIndex, taskCount: event.taskCount }
          : null,
    }),

  finishRun: (payload) => set({ runStatus: 'idle', result: payload }),
  failRun: (message) => set({ runStatus: 'error', streamError: message }),
  reset: () => set(initialState),
}));
