import { Router } from 'express';
import { frontendAgentController, taskAgentController } from '../controllers';
import { frontendAgentRateLimiter, loadUser, requireAuth, validate, validateObjectId } from '../middlewares';
import { regenerateTaskSchema } from '../validators';

/** Mounted at /api/projects/:projectId/plans/:planId/tasks */
export const taskRouter = Router({ mergeParams: true });

taskRouter.use(requireAuth, loadUser);

taskRouter.get('/', frontendAgentController.listTasks);
/** `execute`/`regenerate` dispatch to whichever agent owns the task (Frontend, Phase 6, or
 *  Backend, Phase 7) — see `task-agent.controller.ts`. Reuses the same rate limiter regardless of
 *  which agent ends up running: both are an equally expensive AI + code-generation call, and a
 *  single shared per-user budget is the correct security posture (it prevents mixing task types to
 *  double total codegen throughput), not a gap. */
taskRouter.post('/:taskId/execute', frontendAgentRateLimiter, taskAgentController.executeTask);
taskRouter.post(
  '/:taskId/regenerate',
  frontendAgentRateLimiter,
  validate(regenerateTaskSchema),
  taskAgentController.regenerateTask
);
taskRouter.get('/:taskId/generations', frontendAgentController.listGenerations);
taskRouter.get(
  '/:taskId/generations/:generationId',
  validateObjectId('generationId'),
  frontendAgentController.getGeneration
);

export default taskRouter;
