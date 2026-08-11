import { Router } from 'express';
import { frontendAgentController } from '../controllers';
import { frontendAgentRateLimiter, loadUser, requireAuth, validate, validateObjectId } from '../middlewares';
import { regenerateTaskSchema } from '../validators';

/** Mounted at /api/projects/:projectId/plans/:planId/tasks */
export const taskRouter = Router({ mergeParams: true });

taskRouter.use(requireAuth, loadUser);

taskRouter.get('/', frontendAgentController.listTasks);
taskRouter.post('/:taskId/execute', frontendAgentRateLimiter, frontendAgentController.executeTask);
taskRouter.post(
  '/:taskId/regenerate',
  frontendAgentRateLimiter,
  validate(regenerateTaskSchema),
  frontendAgentController.regenerateTask
);
taskRouter.get('/:taskId/generations', frontendAgentController.listGenerations);
taskRouter.get(
  '/:taskId/generations/:generationId',
  validateObjectId('generationId'),
  frontendAgentController.getGeneration
);

export default taskRouter;
