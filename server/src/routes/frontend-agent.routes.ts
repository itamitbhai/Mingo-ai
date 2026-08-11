import { Router } from 'express';
import { frontendAgentController } from '../controllers';
import { loadUser, requireAuth, validate, workspaceBulkRateLimiter } from '../middlewares';
import { applyGenerationSchema, rejectGenerationSchema } from '../validators';

/** Mounted at /api/projects/:projectId/workspace/ai */
export const frontendAgentRouter = Router({ mergeParams: true });

frontendAgentRouter.use(requireAuth, loadUser);

frontendAgentRouter.post(
  '/apply',
  workspaceBulkRateLimiter,
  validate(applyGenerationSchema),
  frontendAgentController.applyGeneration
);
frontendAgentRouter.post(
  '/reject',
  validate(rejectGenerationSchema),
  frontendAgentController.rejectGeneration
);

export default frontendAgentRouter;
