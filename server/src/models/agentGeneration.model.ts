import { Schema, model, Document, Types } from 'mongoose';
import {
  AgentGenerationStatus,
  AgentType,
  IApiContract,
  IDatabaseChange,
  IDatabaseSchemaContract,
  IDependencyRequest,
  IFrontendOperation,
} from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/**
 * One code-generation attempt for a single task, from the Frontend Agent (Phase 6), the Backend
 * Agent (Phase 7), or the Database Agent (Phase 8). `operations`/`dependencyRequests`/
 * `apiContracts`/`schemaContracts`/`databaseChanges` are stored as `Mixed` — same rationale as
 * `ProjectPlan`'s body fields (projectPlan.model.ts): the real structural gatekeeper is the Zod
 * schema in `agents/frontend/frontend.schema.ts`, `agents/backend/backend.schema.ts`, or
 * `agents/database/database.schema.ts`, validated before every save.
 */
export interface AgentGenerationDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  plan: Types.ObjectId;
  taskId: string;
  agentType: AgentType;
  version: number;
  status: AgentGenerationStatus;
  operations: IFrontendOperation[];
  dependencyRequests?: IDependencyRequest[];
  /** Backend Agent only (Phase 7 spec §25/§51) — empty/undefined for a Frontend Agent generation. */
  apiContracts?: IApiContract[];
  /** Database Agent only (Phase 8 spec §27/§68) — one entry per Mongoose model created/changed. */
  schemaContracts?: IDatabaseSchemaContract[];
  /** Database Agent only (Phase 8 spec §32/§56) — the lighter change-log for the preview UI. */
  databaseChanges?: IDatabaseChange[];
  /** Populated by the Backend Agent (Phase 7 spec §24/§56) or the Database Agent (Phase 8 spec
   *  §26/§51) — an endpoint or schema field outside the approved plan/contract, surfaced to the
   *  user rather than silently blocked. */
  contractWarnings?: string[];
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
      enum: ['frontend', 'backend', 'database'],
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
    apiContracts: { type: Schema.Types.Mixed, default: [] },
    schemaContracts: { type: Schema.Types.Mixed, default: [] },
    databaseChanges: { type: Schema.Types.Mixed, default: [] },
    contractWarnings: { type: [String], default: [] },
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
