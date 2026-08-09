import { Schema, model, Document, Types } from 'mongoose';
import { WorkspaceStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface ProjectWorkspaceDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  rootPath: string;
  status: WorkspaceStatus;
  activeVersion: number;
  lastOpenedAt?: Date;
  lastModifiedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const projectWorkspaceSchema = new Schema<ProjectWorkspaceDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rootPath: {
      type: String,
      default: '/',
    },
    status: {
      type: String,
      enum: Object.values(WorkspaceStatus),
      default: WorkspaceStatus.INITIALIZING,
    },
    activeVersion: {
      type: Number,
      default: 1,
    },
    lastOpenedAt: {
      type: Date,
    },
    lastModifiedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

projectWorkspaceSchema.index({ owner: 1 });
applyToJSON(projectWorkspaceSchema);

export const ProjectWorkspaceModel = model<ProjectWorkspaceDocument>(
  'ProjectWorkspace',
  projectWorkspaceSchema
);
