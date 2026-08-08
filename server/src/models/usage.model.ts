import { Schema, model, Document, Types } from 'mongoose';
import { applyToJSON } from '../utils/applyToJSON';

export interface UsageDocument extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  project: Types.ObjectId;
  conversation: Types.ObjectId;
  modelName: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const usageSchema = new Schema<UsageDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    modelName: {
      type: String,
      required: true,
    },
    inputTokens: { type: Number, default: null },
    outputTokens: { type: Number, default: null },
    totalTokens: { type: Number, default: null },
  },
  { timestamps: true }
);

usageSchema.index({ user: 1, createdAt: -1 });
usageSchema.index({ project: 1, createdAt: -1 });
applyToJSON(usageSchema);

export const UsageModel = model<UsageDocument>('Usage', usageSchema);
