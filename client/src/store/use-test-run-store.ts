import { create } from 'zustand';
import type { ITestFailureAnalysis, ITestRun } from 'shared';
import type { TestRunStage } from '@/types/test-run';

export type TestRunUiStatus = 'idle' | 'streaming' | 'error';

/** Non-persisted — mirrors `use-frontend-agent-store.ts`'s pattern. Holds only the currently-active
 *  test run and its history for the currently-open task, never more. */
interface TestRunState {
  runStatus: TestRunUiStatus;
  activeTaskId: string | null;
  stage: TestRunStage | null;
  stageLabel: string;
  streamError: string | null;

  activeTestRun: ITestRun | null;
  testRunHistory: ITestRun[];

  /** Keyed by result index within `activeTestRun.results` — best-effort AI explanation, cleared
   *  whenever a new run starts. */
  analyses: Record<number, ITestFailureAnalysis>;

  startRun: (taskId: string) => void;
  setStage: (stage: TestRunStage, label: string) => void;
  setQueued: (testRun: ITestRun) => void;
  finishRun: (testRun: ITestRun) => void;
  failRun: (message: string) => void;
  setActiveTestRun: (testRun: ITestRun | null) => void;
  setTestRunHistory: (testRuns: ITestRun[]) => void;
  setAnalysis: (resultIndex: number, analysis: ITestFailureAnalysis) => void;
  reset: () => void;
}

const initialState = {
  runStatus: 'idle' as TestRunUiStatus,
  activeTaskId: null,
  stage: null,
  stageLabel: '',
  streamError: null,
  activeTestRun: null,
  testRunHistory: [] as ITestRun[],
  analyses: {} as Record<number, ITestFailureAnalysis>,
};

export const useTestRunStore = create<TestRunState>((set) => ({
  ...initialState,

  startRun: (taskId) =>
    set({
      runStatus: 'streaming',
      activeTaskId: taskId,
      streamError: null,
      stage: 'preparing',
      stageLabel: 'Preparing test environment…',
      analyses: {},
    }),
  setStage: (stage, label) => set({ stage, stageLabel: label }),
  setQueued: (testRun) => set({ activeTestRun: testRun }),
  finishRun: (testRun) => set({ runStatus: 'idle', stage: 'completed', activeTestRun: testRun }),
  failRun: (message) => set({ runStatus: 'error', stage: 'error', streamError: message }),
  setActiveTestRun: (testRun) => set({ activeTestRun: testRun }),
  setTestRunHistory: (testRuns) => set({ testRunHistory: testRuns }),
  setAnalysis: (resultIndex, analysis) =>
    set((state) => ({ analyses: { ...state.analyses, [resultIndex]: analysis } })),
  reset: () => set(initialState),
}));
