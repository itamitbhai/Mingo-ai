import { Schema, model, Document, Types } from 'mongoose';
import { FileEntryType } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface WorkspaceSnapshotEntry {
  file: Types.ObjectId;
  path: string;
  type: FileEntryType;
  version: number;
  checksum: string;
}

export interface WorkspaceSnapshotDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  description?: string;
  version: number;
  fileCount: number;
  createdBy: Types.ObjectId;
  entries: WorkspaceSnapshotEntry[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const snapshotEntrySchema = new Schema<WorkspaceSnapshotEntry>(
  {
    file: { type: Schema.Types.ObjectId, ref: 'ProjectFile', required: true },
    path: { type: String, required: true },
    type: { type: String, enum: Object.values(FileEntryType), required: true },
    version: { type: Number, required: true },
    checksum: { type: String, required: true },
  },
  { _id: false }
);

const workspaceSnapshotSchema = new Schema<WorkspaceSnapshotDocument>(
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
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    version: {
      type: Number,
      required: true,
    },
    fileCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    entries: {
      type: [snapshotEntrySchema],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

workspaceSnapshotSchema.index({ project: 1, owner: 1, createdAt: -1 });
applyToJSON(workspaceSnapshotSchema);

export const WorkspaceSnapshotModel = model<WorkspaceSnapshotDocument>(
  'WorkspaceSnapshot',
  workspaceSnapshotSchema
);
