import { Router } from 'express';
import { planController } from '../controllers';
import { loadUser, plannerRateLimiter, requireAuth, validate, validateObjectId } from '../middlewares';
import { generatePlanSchema, plansQuerySchema, regeneratePlanSchema, updatePlanSchema } from '../validators';

/** Mounted at /api/projects/:projectId/plans */
export const planRouter = Router({ mergeParams: true });

planRouter.use(requireAuth, loadUser);

planRouter.get('/', validate(plansQuerySchema, 'query'), planController.listPlans);
planRouter.post('/', plannerRateLimiter, validate(generatePlanSchema), planController.generatePlan);
planRouter.get('/:planId', validateObjectId('planId'), planController.getPlan);
planRouter.post(
  '/:planId/regenerate',
  validateObjectId('planId'),
  plannerRateLimiter,
  validate(regeneratePlanSchema),
  planController.regeneratePlan
);
planRouter.patch(
  '/:planId',
  validateObjectId('planId'),
  validate(updatePlanSchema),
  planController.updatePlan
);
planRouter.delete('/:planId', validateObjectId('planId'), planController.deletePlan);

export default planRouter;
