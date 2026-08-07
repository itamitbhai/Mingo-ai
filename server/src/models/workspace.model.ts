import { Schema, model, Document, Types } from 'mongoose';
import { applyToJSON } from '../utils/applyToJSON';

export interface WorkspaceDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  owner: Types.ObjectId;
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

workspaceSchema.index({ owner: 1 });
applyToJSON(workspaceSchema);

export const WorkspaceModel = model<WorkspaceDocument>('Workspace', workspaceSchema);
