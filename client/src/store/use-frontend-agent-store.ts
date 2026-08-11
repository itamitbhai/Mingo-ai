import { create } from 'zustand';
import type { IAgentGeneration, ITaskBoardItem } from 'shared';
import type { FrontendAgentStage } from '@/types/frontend-agent';

export type FrontendAgentRunStatus = 'idle' | 'streaming' | 'error';

/** Non-persisted — mirrors `use-planner-store.ts`'s pattern of holding server-derived state
 *  separately from any UI-preference store. Never stores more than the current task board, the
 *  generation currently under review, and its history. */
interface FrontendAgentState {
  runStatus: FrontendAgentRunStatus;
  activeTaskId: string | null;
  stage: FrontendAgentStage | null;
  stageLabel: string;
  streamError: string | null;

  taskBoard: ITaskBoardItem[];
  activeGeneration: IAgentGeneration | null;
  generationHistory: IAgentGeneration[];

  startRun: (taskId: string) => void;
  setStage: (stage: FrontendAgentStage, label: string) => void;
  finishRun: (generation: IAgentGeneration) => void;
  failRun: (message: string) => void;
  setTaskBoard: (tasks: ITaskBoardItem[]) => void;
  setActiveGeneration: (generation: IAgentGeneration | null) => void;
  setGenerationHistory: (generations: IAgentGeneration[]) => void;
  reset: () => void;
}

const initialState = {
  runStatus: 'idle' as FrontendAgentRunStatus,
  activeTaskId: null,
  stage: null,
  stageLabel: '',
  streamError: null,
  taskBoard: [] as ITaskBoardItem[],
  activeGeneration: null,
  generationHistory: [] as IAgentGeneration[],
};

export const useFrontendAgentStore = create<FrontendAgentState>((set) => ({
  ...initialState,

  startRun: (taskId) =>
    set({
      runStatus: 'streaming',
      activeTaskId: taskId,
      streamError: null,
      stage: 'loading_context',
      stageLabel: 'Reading project context…',
    }),
  setStage: (stage, label) => set({ stage, stageLabel: label }),
  finishRun: (generation) => set({ runStatus: 'idle', stage: 'preview_ready', activeGeneration: generation }),
  failRun: (message) => set({ runStatus: 'error', stage: 'error', streamError: message }),
  setTaskBoard: (tasks) => set({ taskBoard: tasks }),
  setActiveGeneration: (generation) => set({ activeGeneration: generation }),
  setGenerationHistory: (generations) => set({ generationHistory: generations }),
  reset: () => set(initialState),
}));
