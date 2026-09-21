import { Schema, model, Document, Types } from 'mongoose';
import {
  DeploymentEnvironment,
  DeploymentOption,
  DeploymentStage,
  DeploymentStatus,
  DeploymentTrigger,
  HealthCheckStatus,
} from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/** One deployment run (Phase 13 spec §29) — created `QUEUED`, then driven through
 *  `services/deployment/deployment.service.ts`'s `runDeploymentPipeline`, which is the only writer
 *  of `stage`/`status`/logs/`healthCheck` after creation. `rollbackFrom` points at the `Deployment`
 *  a rollback was triggered from — rollbacks are new documents, history is never mutated (spec §23). */
export interface DeploymentHealthCheck {
  status: HealthCheckStatus;
  checkedAt?: Date;
  statusCode?: number;
}

export interface DeploymentDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  provider: DeploymentOption;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  stage?: DeploymentStage;
  triggeredBy: DeploymentTrigger;
  pullRequestNumber?: number;
  branch: string;
  commitHash?: string;
  providerServiceId?: string;
  providerDeployId?: string;
  url?: string;
  commitMessage?: string;
  buildLogs: string;
  deploymentLogs: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  rollbackFrom?: Types.ObjectId;
  healthCheck: DeploymentHealthCheck;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_LOG_CHARS = 200_000;

const deploymentSchema = new Schema<DeploymentDocument>(
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
    provider: {
      type: String,
      enum: Object.values(DeploymentOption),
      required: true,
    },
    environment: {
      type: String,
      enum: Object.values(DeploymentEnvironment),
      default: DeploymentEnvironment.PRODUCTION,
    },
    status: {
      type: String,
      enum: Object.values(DeploymentStatus),
      default: DeploymentStatus.QUEUED,
    },
    stage: {
      type: String,
      enum: Object.values(DeploymentStage),
    },
    triggeredBy: {
      type: String,
      enum: Object.values(DeploymentTrigger),
      default: DeploymentTrigger.MANUAL,
    },
    pullRequestNumber: {
      type: Number,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    commitHash: {
      type: String,
      trim: true,
    },
    providerServiceId: {
      type: String,
    },
    providerDeployId: {
      type: String,
    },
    url: {
      type: String,
      default: '',
    },
    commitMessage: {
      type: String,
      default: '',
      maxlength: 280,
    },
    buildLogs: {
      type: String,
      default: '',
      maxlength: MAX_LOG_CHARS,
    },
    deploymentLogs: {
      type: String,
      default: '',
      maxlength: MAX_LOG_CHARS,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
      maxlength: 2000,
    },
    rollbackFrom: {
      type: Schema.Types.ObjectId,
      ref: 'Deployment',
    },
    healthCheck: {
      status: {
        type: String,
        enum: Object.values(HealthCheckStatus),
        default: HealthCheckStatus.PENDING,
      },
      checkedAt: { type: Date },
      statusCode: { type: Number },
    },
  },
  { timestamps: true }
);

deploymentSchema.index({ project: 1, createdAt: -1 });
deploymentSchema.index({ project: 1, environment: 1, status: 1 });
deploymentSchema.index({ owner: 1, createdAt: -1 });
applyToJSON(deploymentSchema);

export const DeploymentModel = model<DeploymentDocument>('Deployment', deploymentSchema);
