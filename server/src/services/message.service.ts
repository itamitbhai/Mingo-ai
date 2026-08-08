import { Types } from 'mongoose';
import { MessageQueryInput, MessageRole, MessageStatus } from 'shared';
import { MessageDocument, MessageModel } from '../models';
import { ApiError } from '../utils/ApiError';

export async function listMessages(conversationId: Types.ObjectId, query: MessageQueryInput) {
  const filter: Record<string, unknown> = { conversation: conversationId };

  if (query.cursor) {
    filter._id = { $lt: new Types.ObjectId(query.cursor) };
  }

  const docs = await MessageModel.find(filter)
    .sort({ _id: -1 })
    .limit(query.limit + 1);

  const hasMore = docs.length > query.limit;
  const page = docs.slice(0, query.limit).reverse();

  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? page[0]._id.toString() : null,
  };
}

export async function createUserMessage(
  conversationId: Types.ObjectId,
  projectId: Types.ObjectId,
  content: string
) {
  return MessageModel.create({
    conversation: conversationId,
    project: projectId,
    role: MessageRole.USER,
    content,
    status: MessageStatus.COMPLETED,
  });
}

export async function createAssistantPlaceholder(
  conversationId: Types.ObjectId,
  projectId: Types.ObjectId
) {
  return MessageModel.create({
    conversation: conversationId,
    project: projectId,
    role: MessageRole.ASSISTANT,
    content: '',
    status: MessageStatus.PENDING,
  });
}

export async function resetAssistantMessageForRetry(
  conversationId: Types.ObjectId,
  messageId: string
) {
  const message = await MessageModel.findOneAndUpdate(
    { _id: messageId, conversation: conversationId, role: MessageRole.ASSISTANT },
    { content: '', status: MessageStatus.PENDING, tokens: { input: null, output: null, total: null } },
    { new: true }
  );

  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  return message;
}

export async function findPrecedingUserMessage(
  conversationId: Types.ObjectId,
  beforeMessageId: Types.ObjectId
) {
  const message = await MessageModel.findOne({
    conversation: conversationId,
    role: MessageRole.USER,
    _id: { $lt: beforeMessageId },
  }).sort({ _id: -1 });

  if (!message) {
    throw ApiError.notFound('No previous user message to retry from');
  }

  return message;
}

export async function updateMessageContent(
  messageId: Types.ObjectId,
  content: string,
  status: MessageStatus
) {
  await MessageModel.findByIdAndUpdate(messageId, { content, status });
}

export async function finalizeMessage(
  messageId: Types.ObjectId,
  data: {
    content: string;
    status: MessageStatus;
    provider?: string;
    modelName?: string;
    tokens?: { input: number | null; output: number | null; total: number | null };
  }
): Promise<MessageDocument | null> {
  return MessageModel.findByIdAndUpdate(messageId, data, { new: true });
}

export async function getMessageById(id: Types.ObjectId | string) {
  return MessageModel.findById(id);
}

export async function countUserMessages(conversationId: Types.ObjectId) {
  return MessageModel.countDocuments({ conversation: conversationId, role: MessageRole.USER });
}
