import { Types } from 'mongoose';
import { UsageModel, UsagePurpose } from '../models';

interface RecordUsageInput {
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  modelName: string;
  purpose?: UsagePurpose;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export async function recordUsage(data: RecordUsageInput) {
  return UsageModel.create({
    user: data.userId,
    project: data.projectId,
    conversation: data.conversationId,
    modelName: data.modelName,
    purpose: data.purpose ?? 'chat',
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    totalTokens: data.totalTokens,
  });
}
