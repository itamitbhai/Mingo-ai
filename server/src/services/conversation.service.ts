import { Types } from 'mongoose';
import { CreateConversationInput, UpdateConversationInput } from 'shared';
import { ConversationModel, MessageModel } from '../models';
import { ApiError } from '../utils/ApiError';
import { getProjectById } from './project.service';

export async function assertProjectOwnership(owner: Types.ObjectId, projectId: string) {
  return getProjectById(owner, projectId);
}

export async function listConversations(owner: Types.ObjectId, projectId: string) {
  await assertProjectOwnership(owner, projectId);

  return ConversationModel.find({ project: projectId, owner }).sort({ updatedAt: -1 }).limit(100);
}

export async function getConversationById(owner: Types.ObjectId, id: string) {
  const conversation = await ConversationModel.findOne({ _id: id, owner });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  return conversation;
}

export async function createConversation(
  owner: Types.ObjectId,
  projectId: string,
  data: CreateConversationInput
) {
  await assertProjectOwnership(owner, projectId);

  return ConversationModel.create({
    project: projectId,
    owner,
    title: data.title?.trim() || 'New Conversation',
    lastMessageAt: new Date(),
  });
}

export async function renameConversation(
  owner: Types.ObjectId,
  id: string,
  data: UpdateConversationInput
) {
  const conversation = await getConversationById(owner, id);
  conversation.title = data.title;
  await conversation.save();
  return conversation;
}

export async function deleteConversation(owner: Types.ObjectId, id: string) {
  const conversation = await getConversationById(owner, id);
  await MessageModel.deleteMany({ conversation: conversation._id });
  await conversation.deleteOne();
}

export async function touchConversation(id: Types.ObjectId, title?: string) {
  const update: Record<string, unknown> = { lastMessageAt: new Date() };
  if (title) {
    update.title = title;
  }
  await ConversationModel.findByIdAndUpdate(id, update);
}
