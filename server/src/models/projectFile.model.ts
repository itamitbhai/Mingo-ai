import { Schema, model, Document, Types } from 'mongoose';
import { FileEntryType, MAX_FILE_CONTENT_LENGTH } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface ProjectFileDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  path: string;
  type: FileEntryType;
  content: string;
  language?: string;
  mimeType?: string;
  isBinary: boolean;
  checksum?: string;
  parentPath: string | null;
  size: number;
  version: number;
  dependencies: string[];
  lastAnalyzedAt?: Date;
  analysisStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const projectFileSchema = new Schema<ProjectFileDocument>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: Object.values(FileEntryType),
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: MAX_FILE_CONTENT_LENGTH,
    },
    language: {
      type: String,
    },
    mimeType: {
      type: String,
    },
    isBinary: {
      type: Boolean,
      default: false,
    },
    checksum: {
      type: String,
    },
    parentPath: {
      type: String,
      default: null,
    },
    size: {
      type: Number,
      default: 0,
    },
    version: {
      type: Number,
      default: 1,
    },
    dependencies: {
      type: [String],
      default: undefined,
    },
    lastAnalyzedAt: {
      type: Date,
    },
    analysisStatus: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

projectFileSchema.index({ project: 1 });
projectFileSchema.index({ owner: 1 });
projectFileSchema.index({ project: 1, path: 1 }, { unique: true });
applyToJSON(projectFileSchema);

export const ProjectFileModel = model<ProjectFileDocument>('ProjectFile', projectFileSchema);
