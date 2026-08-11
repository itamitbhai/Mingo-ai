import { FrontendStage } from '../frontend/frontend.types';
import { PlannerStage } from '../planner/planner.types';

export type AutopilotPhase = 'planning' | 'approving' | 'task';

interface AutopilotPlanningEvent {
  phase: 'planning';
  stage: PlannerStage;
  label: string;
  attempt?: number;
}

interface AutopilotApprovingEvent {
  phase: 'approving';
  label: string;
}

/** `'applying'` and `'skipped'` are synthetic stages the orchestrator adds itself: a non-frontend
 *  task never reaches the Frontend Agent, and `applyGeneration` has no `onStage` of its own. */
export type AutopilotTaskStage = FrontendStage | 'applying' | 'skipped';

interface AutopilotTaskEvent {
  phase: 'task';
  stage: AutopilotTaskStage;
  label: string;
  attempt?: number;
  taskId: string;
  taskTitle: string;
  taskIndex: number;
  taskCount: number;
}

export type AutopilotStageEvent = AutopilotPlanningEvent | AutopilotApprovingEvent | AutopilotTaskEvent;

export type OnAutopilotStage = (event: AutopilotStageEvent) => void;
