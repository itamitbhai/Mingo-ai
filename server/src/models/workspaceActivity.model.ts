import { Schema, model, Document, Types } from 'mongoose';
import { WorkspaceActivityAction } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface WorkspaceActivityDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  user: Types.ObjectId;
  file?: Types.ObjectId;
  action: WorkspaceActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const workspaceActivitySchema = new Schema<WorkspaceActivityDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    file: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectFile',
    },
    action: {
      type: String,
      enum: Object.values(WorkspaceActivityAction),
      required: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 280,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

workspaceActivitySchema.index({ project: 1, createdAt: -1 });
applyToJSON(workspaceActivitySchema);

export const WorkspaceActivityModel = model<WorkspaceActivityDocument>(
  'WorkspaceActivity',
  workspaceActivitySchema
);
