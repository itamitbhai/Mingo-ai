import { Router } from 'express';
import { conversationController } from '../controllers';
import { loadUser, requireAuth, validate, validateObjectId } from '../middlewares';
import { createConversationSchema, updateConversationSchema } from '../validators';
import messageRoutes from './message.routes';

/** Mounted at /api/projects/:projectId/conversations */
export const projectConversationsRouter = Router({ mergeParams: true });

projectConversationsRouter.use(requireAuth, loadUser);
projectConversationsRouter.get(
  '/',
  validateObjectId('projectId'),
  conversationController.getConversations
);
projectConversationsRouter.post(
  '/',
  validateObjectId('projectId'),
  validate(createConversationSchema),
  conversationController.createConversation
);

/** Mounted at /api/conversations */
export const conversationsRouter = Router();

conversationsRouter.use(requireAuth, loadUser);
conversationsRouter.get(
  '/:conversationId',
  validateObjectId('conversationId'),
  conversationController.getConversation
);
conversationsRouter.patch(
  '/:conversationId',
  validateObjectId('conversationId'),
  validate(updateConversationSchema),
  conversationController.updateConversation
);
conversationsRouter.delete(
  '/:conversationId',
  validateObjectId('conversationId'),
  conversationController.deleteConversation
);
conversationsRouter.use(
  '/:conversationId/messages',
  validateObjectId('conversationId'),
  messageRoutes
);
