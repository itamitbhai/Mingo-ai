import { Schema, model, Document, Types } from 'mongoose';
import { LockType } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface WorkspaceLockDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  file: Types.ObjectId;
  lockedBy: Types.ObjectId;
  lockType: LockType;
  expiresAt: Date;
  createdAt: Date;
}

const workspaceLockSchema = new Schema<WorkspaceLockDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    file: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectFile',
      required: true,
      unique: true,
    },
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lockType: {
      type: String,
      enum: Object.values(LockType),
      default: LockType.USER,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** TTL index — Mongo auto-deletes an expired lock document, so locks can never become permanent. */
workspaceLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
workspaceLockSchema.index({ project: 1 });
applyToJSON(workspaceLockSchema);

export const WorkspaceLockModel = model<WorkspaceLockDocument>('WorkspaceLock', workspaceLockSchema);
