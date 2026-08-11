import { Schema, model, Document, Types } from 'mongoose';
import { TaskExecutionStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/**
 * Per-task run state for the Frontend Agent (Phase 6). `ProjectPlan.tasks` is immutable/versioned
 * and carries no status field, so execution state is tracked here instead, keyed by
 * `{plan, taskId}` — never by writing into the plan document.
 */
export interface TaskExecutionDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  plan: Types.ObjectId;
  taskId: string;
  status: TaskExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  latestGenerationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskExecutionSchema = new Schema<TaskExecutionDocument>(
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
    taskId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskExecutionStatus),
      default: TaskExecutionStatus.PENDING,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, maxlength: 500 },
    latestGenerationId: {
      type: Schema.Types.ObjectId,
      ref: 'AgentGeneration',
    },
  },
  { timestamps: true }
);

/** One execution record per task within a plan — also the mutex a task run-lock relies on
 *  (a duplicate-key error on this index means the task is already running). */
taskExecutionSchema.index({ plan: 1, taskId: 1 }, { unique: true });
taskExecutionSchema.index({ project: 1 });
applyToJSON(taskExecutionSchema);

export const TaskExecutionModel = model<TaskExecutionDocument>('TaskExecution', taskExecutionSchema);
