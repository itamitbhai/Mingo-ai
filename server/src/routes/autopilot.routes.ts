import { Router } from 'express';
import { autopilotController } from '../controllers';
import { frontendAgentRateLimiter, loadUser, plannerRateLimiter, requireAuth, validate } from '../middlewares';
import { generatePlanSchema } from '../validators';

/** Mounted at /api/projects/:projectId/autopilot — composes the Planner + Frontend Agent into one
 *  end-to-end "Build It Now" run, so it's gated by both of their rate limiters rather than a third
 *  one, since it's directly one planner call plus N frontend-agent calls. */
export const autopilotRouter = Router({ mergeParams: true });

autopilotRouter.use(requireAuth, loadUser);

autopilotRouter.post(
  '/',
  plannerRateLimiter,
  frontendAgentRateLimiter,
  validate(generatePlanSchema),
  autopilotController.runAutopilot
);

export default autopilotRouter;
