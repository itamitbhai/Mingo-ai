import { Router } from 'express';
import { createWorkflowSchema } from 'shared';
import { workflowController } from '../controllers';
import { loadUser, orchestratorRateLimiter, requireAuth, validate, validateObjectId } from '../middlewares';

/** Mounted at /api/projects/:projectId/workflows (Phase 10 spec §58) */
export const workflowRouter = Router({ mergeParams: true });

workflowRouter.use(requireAuth, loadUser);

workflowRouter.post('/', orchestratorRateLimiter, validate(createWorkflowSchema), workflowController.createWorkflow);
workflowRouter.get('/', workflowController.listWorkflows);
workflowRouter.get('/:workflowId', validateObjectId('workflowId'), workflowController.getWorkflow);
workflowRouter.get('/:workflowId/events', validateObjectId('workflowId'), workflowController.streamWorkflowEvents);
workflowRouter.post('/:workflowId/pause', validateObjectId('workflowId'), workflowController.pauseWorkflow);
workflowRouter.post('/:workflowId/resume', validateObjectId('workflowId'), workflowController.resumeWorkflow);
workflowRouter.post('/:workflowId/cancel', validateObjectId('workflowId'), workflowController.cancelWorkflow);
workflowRouter.post(
  '/:workflowId/tasks/:taskId/retry',
  validateObjectId('workflowId'),
  workflowController.retryTask
);

export default workflowRouter;
