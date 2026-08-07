import { Schema, model, Document, Types } from 'mongoose';
import { ActivityType } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface ActivityDocument extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 280,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ user: 1, createdAt: -1 });
applyToJSON(activitySchema);

export const ActivityModel = model<ActivityDocument>('Activity', activitySchema);
