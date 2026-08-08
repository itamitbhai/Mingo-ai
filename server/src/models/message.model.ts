import { Schema, model, Document, Types } from 'mongoose';
import { MessageRole, MessageStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface MessageTokens {
  input: number | null;
  output: number | null;
  total: number | null;
}

export interface MessageDocument extends Document {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  project: Types.ObjectId;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  provider?: string;
  modelName?: string;
  tokens: MessageTokens;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDocument>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(MessageRole),
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: 20000,
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.COMPLETED,
    },
    provider: {
      type: String,
    },
    modelName: {
      type: String,
    },
    tokens: {
      input: { type: Number, default: null },
      output: { type: Number, default: null },
      total: { type: Number, default: null },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ conversation: 1, _id: -1 });
messageSchema.index({ project: 1 });
applyToJSON(messageSchema);

export const MessageModel = model<MessageDocument>('Message', messageSchema);
