import { Schema, model, Document, Types } from 'mongoose';
import {
  AuthOption,
  BackendStack,
  DatabaseOption,
  DeploymentOption,
  FrontendStack,
  ProjectStatus,
  StylingOption,
} from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface ProjectDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  frontend: FrontendStack;
  backend: BackendStack;
  database: DatabaseOption;
  authentication: AuthOption;
  styling: StylingOption;
  deployment: DeploymentOption;
  status: ProjectStatus;
  owner: Types.ObjectId;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: 3,
      maxlength: 60,
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    frontend: {
      type: String,
      enum: Object.values(FrontendStack),
      required: true,
    },
    backend: {
      type: String,
      enum: Object.values(BackendStack),
      required: true,
    },
    database: {
      type: String,
      enum: Object.values(DatabaseOption),
      required: true,
    },
    authentication: {
      type: String,
      enum: Object.values(AuthOption),
      required: true,
    },
    styling: {
      type: String,
      enum: Object.values(StylingOption),
      required: true,
    },
    deployment: {
      type: String,
      enum: Object.values(DeploymentOption),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.ACTIVE,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    favorite: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ name: 'text', description: 'text' });
applyToJSON(projectSchema);

export const ProjectModel = model<ProjectDocument>('Project', projectSchema);
