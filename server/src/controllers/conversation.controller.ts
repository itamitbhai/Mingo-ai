import { Request, Response } from 'express';
import { CreateConversationInput, UpdateConversationInput } from 'shared';
import * as conversationService from '../services/conversation.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const conversations = await conversationService.listConversations(user._id, req.params.projectId);
  sendSuccess(res, conversations);
});

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateConversationInput;

  const conversation = await conversationService.createConversation(
    user._id,
    req.params.projectId,
    body
  );
  sendCreated(res, conversation, 'Conversation created');
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const conversation = await conversationService.getConversationById(
    user._id,
    req.params.conversationId
  );
  sendSuccess(res, conversation);
});

export const updateConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as UpdateConversationInput;

  const conversation = await conversationService.renameConversation(
    user._id,
    req.params.conversationId,
    body
  );
  sendSuccess(res, conversation, 'Conversation renamed');
});

export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  await conversationService.deleteConversation(user._id, req.params.conversationId);
  sendSuccess(res, null, 'Conversation deleted');
});
