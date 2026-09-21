import { Schema, model, Document, Types } from 'mongoose';
import {
  AuthOption,
  BackendStack,
  DatabaseOption,
  DeploymentOption,
  FrontendStack,
  GitSyncStatus,
  ProjectStatus,
  StylingOption,
} from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/** A project's GitHub connection (Phase 12 spec §6) — absent/`connected: false` until the user
 *  connects an existing project to a repository or imports one. Kept as a subdocument rather than a
 *  separate collection since it's always read/written alongside its `Project` and there's exactly
 *  one per project. */
export interface ProjectGitHubConfig {
  connected: boolean;
  repositoryId?: number;
  repositoryName?: string;
  repositoryFullName?: string;
  repositoryUrl?: string;
  owner?: string;
  defaultBranch?: string;
  currentBranch?: string;
  lastSyncedAt?: Date;
  syncStatus: GitSyncStatus;
}

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
  github: ProjectGitHubConfig;
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
    github: {
      type: new Schema<ProjectGitHubConfig>(
        {
          connected: { type: Boolean, default: false },
          repositoryId: { type: Number },
          repositoryName: { type: String },
          repositoryFullName: { type: String },
          repositoryUrl: { type: String },
          owner: { type: String },
          defaultBranch: { type: String },
          currentBranch: { type: String },
          lastSyncedAt: { type: Date },
          syncStatus: {
            type: String,
            enum: Object.values(GitSyncStatus),
            default: GitSyncStatus.NOT_CONNECTED,
          },
        },
        { _id: false }
      ),
      default: () => ({ connected: false, syncStatus: GitSyncStatus.NOT_CONNECTED }),
    },
  },
  { timestamps: true }
);

projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ name: 'text', description: 'text' });
applyToJSON(projectSchema);

export const ProjectModel = model<ProjectDocument>('Project', projectSchema);
