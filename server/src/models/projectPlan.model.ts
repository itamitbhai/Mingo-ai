import { Schema, model, Document, Types } from 'mongoose';
import {
  IPlanApiEndpoint,
  IPlanArchitecture,
  IPlanConflict,
  IPlanDatabase,
  IPlanFeature,
  IPlanFileEntry,
  IPlanFrontend,
  IPlanNonFunctionalRequirement,
  IPlanRequirements,
  IPlanRisk,
  IPlanSecurityRequirement,
  IPlanStack,
  IPlanTask,
  ProjectPlanStatus,
} from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/**
 * The plan body (`requirements` through `conflicts`) is stored as loosely-typed `Mixed` JSON
 * rather than hand-built Mongoose sub-schemas — it's 15+ nested shapes deep and always read/
 * written as one unit, never queried by sub-field. The real structural gatekeeper is the Zod
 * schema in `agents/planner/planner.schema.ts`, validated before every save (spec §35) — a
 * parallel Mongoose schema here would just duplicate it.
 */
export interface ProjectPlanDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  conversation?: Types.ObjectId;
  version: number;
  status: ProjectPlanStatus;
  prompt: string;
  error?: string;
  summary?: string;
  projectType?: string;
  requirements?: IPlanRequirements;
  stack?: IPlanStack;
  architecture?: IPlanArchitecture;
  features?: IPlanFeature[];
  database?: IPlanDatabase;
  api?: IPlanApiEndpoint[];
  frontend?: IPlanFrontend;
  files?: IPlanFileEntry[];
  tasks?: IPlanTask[];
  executionOrder?: string[];
  risks?: IPlanRisk[];
  assumptions?: string[];
  security?: IPlanSecurityRequirement[];
  nonFunctionalRequirements?: IPlanNonFunctionalRequirement[];
  conflicts?: IPlanConflict[];
  createdAt: Date;
  updatedAt: Date;
}

const projectPlanSchema = new Schema<ProjectPlanDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    version: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ProjectPlanStatus),
      default: ProjectPlanStatus.DRAFT,
    },
    prompt: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    error: {
      type: String,
      maxlength: 500,
    },
    summary: { type: String },
    projectType: { type: String },
    requirements: { type: Schema.Types.Mixed },
    stack: { type: Schema.Types.Mixed },
    architecture: { type: Schema.Types.Mixed },
    features: { type: Schema.Types.Mixed },
    database: { type: Schema.Types.Mixed },
    api: { type: Schema.Types.Mixed },
    frontend: { type: Schema.Types.Mixed },
    files: { type: Schema.Types.Mixed },
    tasks: { type: Schema.Types.Mixed },
    executionOrder: { type: [String], default: undefined },
    risks: { type: Schema.Types.Mixed },
    assumptions: { type: [String], default: undefined },
    security: { type: Schema.Types.Mixed },
    nonFunctionalRequirements: { type: Schema.Types.Mixed },
    conflicts: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

projectPlanSchema.index({ project: 1, version: -1 }, { unique: true });
projectPlanSchema.index({ project: 1, owner: 1, createdAt: -1 });
applyToJSON(projectPlanSchema);

export const ProjectPlanModel = model<ProjectPlanDocument>('ProjectPlan', projectPlanSchema);
