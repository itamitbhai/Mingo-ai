import type { IAgentGeneration } from 'shared';

export type FrontendAgentStage =
  | 'loading_context'
  | 'reading_files'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'preview_ready'
  | 'done'
  | 'error';

export interface FrontendAgentStageStreamEvent {
  type: 'stage';
  stage: FrontendAgentStage;
  label: string;
  attempt?: number;
}

export interface FrontendAgentDoneStreamEvent {
  type: 'done';
  generation: IAgentGeneration;
}

export interface FrontendAgentErrorStreamEvent {
  type: 'error';
  message: string;
}

export type FrontendAgentStreamEvent =
  | FrontendAgentStageStreamEvent
  | FrontendAgentDoneStreamEvent
  | FrontendAgentErrorStreamEvent;
