import { Schema, model, Document, Types } from 'mongoose';
import { DeploymentOption, DeploymentStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface DeploymentDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  provider: DeploymentOption;
  status: DeploymentStatus;
  url?: string;
  commitMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
    status: {
      type: String,
      enum: Object.values(DeploymentStatus),
      default: DeploymentStatus.PENDING,
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
  },
  { timestamps: true }
);

deploymentSchema.index({ project: 1, createdAt: -1 });
deploymentSchema.index({ owner: 1, createdAt: -1 });
applyToJSON(deploymentSchema);

export const DeploymentModel = model<DeploymentDocument>('Deployment', deploymentSchema);
