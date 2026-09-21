import { Schema, model, Document, Types } from 'mongoose';
import { DeploymentEnvironment, DeploymentOption, DeploymentServiceType } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface DeploymentHealthCheckConfig {
  path: string;
  expectedStatus: number;
  timeoutSeconds: number;
  retries: number;
}

/** A project's deployment settings for one environment (Phase 13 spec §4/§29) — at most one per
 *  `{project, environment}` pair, upserted by `services/deployment/deploymentConfig.service.ts`. */
export interface DeploymentConfigDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  provider: DeploymentOption;
  serviceType: DeploymentServiceType;
  environment: DeploymentEnvironment;
  branch: string;
  buildCommand: string;
  startCommand?: string;
  testCommand?: string;
  outputDirectory?: string;
  rootDirectory?: string;
  framework?: string;
  nodeVersion?: string;
  autoDeploy: boolean;
  healthCheck: DeploymentHealthCheckConfig;
  createdAt: Date;
  updatedAt: Date;
}

const deploymentConfigSchema = new Schema<DeploymentConfigDocument>(
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
    serviceType: {
      type: String,
      enum: Object.values(DeploymentServiceType),
      required: true,
    },
    environment: {
      type: String,
      enum: Object.values(DeploymentEnvironment),
      required: true,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
      default: 'main',
    },
    buildCommand: {
      type: String,
      required: true,
      trim: true,
    },
    startCommand: {
      type: String,
      trim: true,
    },
    testCommand: {
      type: String,
      trim: true,
    },
    outputDirectory: {
      type: String,
      trim: true,
    },
    rootDirectory: {
      type: String,
      trim: true,
    },
    framework: {
      type: String,
      trim: true,
    },
    nodeVersion: {
      type: String,
      trim: true,
    },
    autoDeploy: {
      type: Boolean,
      default: false,
    },
    healthCheck: {
      path: { type: String, default: '/' },
      expectedStatus: { type: Number, default: 200 },
      timeoutSeconds: { type: Number, default: 30 },
      retries: { type: Number, default: 3 },
    },
  },
  { timestamps: true }
);

deploymentConfigSchema.index({ project: 1, environment: 1 }, { unique: true });
applyToJSON(deploymentConfigSchema);

export const DeploymentConfigModel = model<DeploymentConfigDocument>(
  'DeploymentConfig',
  deploymentConfigSchema
);
