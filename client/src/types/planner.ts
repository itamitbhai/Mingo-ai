import type { IPlanDiff, IProjectPlan } from 'shared';

export type PlannerStage =
  | 'loading_context'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'saving'
  | 'done'
  | 'error';

export interface PlannerStageStreamEvent {
  type: 'stage';
  stage: PlannerStage;
  label: string;
  attempt?: number;
}

export interface PlannerDoneStreamEvent {
  type: 'done';
  plan: IProjectPlan;
  previousPlan?: IProjectPlan;
  diff?: IPlanDiff;
}

export interface PlannerErrorStreamEvent {
  type: 'error';
  message: string;
}

export type PlannerStreamEvent = PlannerStageStreamEvent | PlannerDoneStreamEvent | PlannerErrorStreamEvent;

/**
 * Descriptive sub-labels cycled client-side while the server's single `generating` stage is
 * active — the AI call itself is one non-streamed request, so these narrate progress rather than
 * claim discrete backend completions (see docs/ARCHITECTURE.md's "Planner Agent" section).
 */
export const GENERATING_SUB_LABELS = [
  'Understanding requirements…',
  'Analyzing technology stack…',
  'Designing architecture…',
  'Breaking down features…',
  'Planning the database…',
  'Planning the APIs…',
  'Creating the task graph…',
] as const;
