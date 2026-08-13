import type { ITestRun } from 'shared';

export type TestRunStage = 'preparing' | 'installing' | 'running' | 'collecting' | 'completed' | 'error';

export interface TestRunQueuedStreamEvent {
  type: 'queued';
  testRun: ITestRun;
}

export interface TestRunStageStreamEvent {
  type: 'stage';
  stage: TestRunStage;
  label: string;
}

export interface TestRunDoneStreamEvent {
  type: 'done';
  testRun: ITestRun;
}

export interface TestRunErrorStreamEvent {
  type: 'error';
  message: string;
}

export type TestRunStreamEvent =
  | TestRunQueuedStreamEvent
  | TestRunStageStreamEvent
  | TestRunDoneStreamEvent
  | TestRunErrorStreamEvent;
