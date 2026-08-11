import { Schema, model, Document, Types } from 'mongoose';
import { AgentGenerationStatus, IDependencyRequest, IFrontendOperation } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/**
 * One Frontend Agent code-generation attempt for a single task (Phase 6). `operations` and
 * `dependencyRequests` are stored as `Mixed` — same rationale as `ProjectPlan`'s body fields
 * (projectPlan.model.ts): the real structural gatekeeper is the Zod schema in
 * `agents/frontend/frontend.schema.ts`, validated before every save.
 */
export interface AgentGenerationDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  plan: Types.ObjectId;
  taskId: string;
  agentType: 'frontend';
  version: number;
  status: AgentGenerationStatus;
  operations: IFrontendOperation[];
  dependencyRequests?: IDependencyRequest[];
  notes?: string;
  feedback?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const agentGenerationSchema = new Schema<AgentGenerationDocument>(
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
    agentType: {
      type: String,
      enum: ['frontend'],
      default: 'frontend',
    },
    version: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AgentGenerationStatus),
      default: AgentGenerationStatus.QUEUED,
    },
    operations: { type: Schema.Types.Mixed, default: [] },
    dependencyRequests: { type: Schema.Types.Mixed, default: [] },
    notes: { type: String, maxlength: 2000 },
    feedback: { type: String, maxlength: 1000 },
    error: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

agentGenerationSchema.index({ plan: 1, taskId: 1, version: -1 }, { unique: true });
agentGenerationSchema.index({ project: 1, createdAt: -1 });
applyToJSON(agentGenerationSchema);

export const AgentGenerationModel = model<AgentGenerationDocument>('AgentGeneration', agentGenerationSchema);
