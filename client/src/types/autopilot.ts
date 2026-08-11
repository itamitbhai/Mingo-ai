import type { IAutopilotTaskResult, IProjectPlan } from 'shared';
import type { FrontendAgentStage } from '@/types/frontend-agent';
import type { PlannerStage } from '@/types/planner';

export type AutopilotPhase = 'planning' | 'approving' | 'task';

/** `'applying'` and `'skipped'` are synthetic stages the server's orchestrator adds itself — see
 *  `server/src/agents/autopilot/autopilot.types.ts`. */
export type AutopilotTaskStage = FrontendAgentStage | 'applying' | 'skipped';

export interface AutopilotPlanningStageEvent {
  type: 'stage';
  phase: 'planning';
  stage: PlannerStage;
  label: string;
  attempt?: number;
}

export interface AutopilotApprovingStageEvent {
  type: 'stage';
  phase: 'approving';
  label: string;
}

export interface AutopilotTaskStageEvent {
  type: 'stage';
  phase: 'task';
  stage: AutopilotTaskStage;
  label: string;
  attempt?: number;
  taskId: string;
  taskTitle: string;
  taskIndex: number;
  taskCount: number;
}

export type AutopilotStageStreamEvent =
  | AutopilotPlanningStageEvent
  | AutopilotApprovingStageEvent
  | AutopilotTaskStageEvent;

export interface AutopilotDoneStreamEvent {
  type: 'done';
  plan: IProjectPlan;
  tasks: IAutopilotTaskResult[];
  stoppedEarly: boolean;
}

export interface AutopilotErrorStreamEvent {
  type: 'error';
  message: string;
}

export type AutopilotStreamEvent = AutopilotStageStreamEvent | AutopilotDoneStreamEvent | AutopilotErrorStreamEvent;
