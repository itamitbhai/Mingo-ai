import { Schema, model, Document, Types } from 'mongoose';
import { FileChangeType } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface ProjectFileVersionDocument extends Document {
  _id: Types.ObjectId;
  file: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  version: number;
  content: string;
  checksum: string;
  changedBy: Types.ObjectId;
  changeType: FileChangeType;
  changeSummary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const projectFileVersionSchema = new Schema<ProjectFileVersionDocument>(
  {
    file: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectFile',
      required: true,
    },
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
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    checksum: {
      type: String,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changeType: {
      type: String,
      enum: Object.values(FileChangeType),
      required: true,
    },
    changeSummary: {
      type: String,
      maxlength: 280,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

projectFileVersionSchema.index({ file: 1, version: -1 });
projectFileVersionSchema.index({ project: 1, owner: 1 });
applyToJSON(projectFileVersionSchema);

export const ProjectFileVersionModel = model<ProjectFileVersionDocument>(
  'ProjectFileVersion',
  projectFileVersionSchema
);
