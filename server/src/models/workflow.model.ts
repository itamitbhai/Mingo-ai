import { Schema, model, Document, Types } from 'mongoose';
import { IWorkflowEvent, IWorkflowTaskState, WorkflowMode, WorkflowStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/** Same shape as the shared `IWorkflowTaskState`, except `startedAt`/`completedAt` are real `Date`
 *  objects on the Mongoose side (like every other document's timestamp fields) — `applyToJSON`
 *  serializes them to ISO strings for the API-facing shape, matching how `createdAt`/`updatedAt`
 *  already work on every model. */
export interface WorkflowTaskStateDoc extends Omit<IWorkflowTaskState, 'startedAt' | 'completedAt'> {
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * A persisted, resumable Orchestrator run (Phase 10) — deliberately the only new model this phase
 * adds. `tasks` is orchestrator-only *overlay* state (status/attempts/failure category) layered on
 * top of the plan's tasks; it never duplicates a generation's operations/content, which stays on
 * `AgentGenerationModel`, referenced here only by id (`generationIds`). `TaskExecutionModel` remains
 * the source of truth for "has this task's latest generation been applied" (what the task board
 * reads); `Workflow.tasks` is this specific run's own scheduling view, since a task can be re-run
 * across multiple workflow runs over time.
 *
 * `events` is a capped embedded log (oldest dropped past `orchestratorConfig.MAX_EVENTS`) — same
 * bounded-log precedent as `TestRun.logs` — giving a late SSE subscriber or the history view a
 * replay buffer without a second ever-growing collection (this is what satisfies the spec's
 * `WorkflowEvent` model without introducing one).
 */
export interface WorkflowDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  plan: Types.ObjectId;
  owner: Types.ObjectId;
  status: WorkflowStatus;
  mode: WorkflowMode;
  maxConcurrency: number;
  fixCycles: number;
  tasks: WorkflowTaskStateDoc[];
  events: IWorkflowEvent[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const workflowSchema = new Schema<WorkflowDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectPlan',
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WorkflowStatus),
      default: WorkflowStatus.CREATED,
    },
    mode: {
      type: String,
      enum: Object.values(WorkflowMode),
      default: WorkflowMode.REVIEW,
    },
    maxConcurrency: { type: Number, default: 3 },
    fixCycles: { type: Number, default: 0 },
    // Mixed (not a Mongoose sub-schema array) — same rationale as `TestRun.results`: Mongoose's own
    // typings resolve `[Schema.Types.Mixed]` ambiguously against its `Schema[]` overload, and the
    // real structural gatekeeper is the shared TS types, not a parallel Mongoose schema.
    tasks: { type: Schema.Types.Mixed, default: [] },
    events: { type: Schema.Types.Mixed, default: [] },
    error: { type: String, maxlength: 1000 },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

workflowSchema.index({ project: 1, createdAt: -1 });
workflowSchema.index({ plan: 1, createdAt: -1 });
applyToJSON(workflowSchema);

export const WorkflowModel = model<WorkflowDocument>('Workflow', workflowSchema);
