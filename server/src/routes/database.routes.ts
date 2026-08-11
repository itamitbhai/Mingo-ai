import { Router } from 'express';
import { databaseAgentController } from '../controllers';
import { loadUser, requireAuth } from '../middlewares';

/** Mounted at /api/projects/:projectId/database */
export const databaseRouter = Router({ mergeParams: true });

databaseRouter.use(requireAuth, loadUser);

databaseRouter.get('/schema', databaseAgentController.getSchema);

export default databaseRouter;
