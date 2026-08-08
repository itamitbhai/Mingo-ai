import { Schema, model, Document, Types } from 'mongoose';
import { applyToJSON } from '../utils/applyToJSON';

export interface ConversationDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  title: string;
  lastMessageAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: 'New Conversation',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ project: 1, updatedAt: -1 });
conversationSchema.index({ owner: 1, updatedAt: -1 });
applyToJSON(conversationSchema);

export const ConversationModel = model<ConversationDocument>('Conversation', conversationSchema);
