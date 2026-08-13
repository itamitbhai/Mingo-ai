import { Router } from 'express';
import { createTestRunSchema, testRunQuerySchema } from 'shared';
import { testRunController } from '../controllers';
import { loadUser, requireAuth, testRunExecutionRateLimiter, validate, validateObjectId } from '../middlewares';

/** Mounted at /api/projects/:projectId/test-runs (Phase 9 spec §75) */
export const testRunRouter = Router({ mergeParams: true });

testRunRouter.use(requireAuth, loadUser);

testRunRouter.post('/', testRunExecutionRateLimiter, validate(createTestRunSchema), testRunController.createTestRun);
testRunRouter.get('/', validate(testRunQuerySchema, 'query'), testRunController.listTestRuns);
testRunRouter.get('/:testRunId', validateObjectId('testRunId'), testRunController.getTestRun);
testRunRouter.post('/:testRunId/cancel', validateObjectId('testRunId'), testRunController.cancelTestRun);
testRunRouter.post(
  '/:testRunId/results/:resultIndex/explain',
  validateObjectId('testRunId'),
  testRunController.explainFailure
);
testRunRouter.post(
  '/:testRunId/results/:resultIndex/fix',
  validateObjectId('testRunId'),
  testRunController.generateFix
);

export default testRunRouter;
