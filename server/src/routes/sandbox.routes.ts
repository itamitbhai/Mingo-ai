import { Router } from 'express';
import { createSandboxRunSchema } from 'shared';
import { sandboxController } from '../controllers';
import { loadUser, requireAuth, sandboxRateLimiter, validate, validateObjectId } from '../middlewares';

/** Mounted at /api/projects/:projectId/sandbox (Phase 11 spec §64) */
export const sandboxRouter = Router({ mergeParams: true });

sandboxRouter.use(requireAuth, loadUser);

sandboxRouter.post('/', sandboxRateLimiter, validate(createSandboxRunSchema), sandboxController.createSandboxRun);
sandboxRouter.get('/', sandboxController.listSandboxRuns);
sandboxRouter.get('/:sandboxId', validateObjectId('sandboxId'), sandboxController.getSandboxRun);
sandboxRouter.get('/:sandboxId/events', validateObjectId('sandboxId'), sandboxController.streamSandboxEvents);
sandboxRouter.post('/:sandboxId/stop', validateObjectId('sandboxId'), sandboxController.stopSandboxRun);

export default sandboxRouter;
