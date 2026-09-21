import { Router } from 'express';
import {
  createDeploymentSchema,
  createEnvironmentVariableSchema,
  deploymentConfigSchema,
  deploymentHistoryQuerySchema,
  updateEnvironmentVariableSchema,
} from 'shared';
import { deploymentConfigController, deploymentController, environmentVariableController } from '../controllers';
import { deploymentRateLimiter, loadUser, requireAuth, validate, validateObjectId } from '../middlewares';
import { environmentQuerySchema } from '../validators/deployment.validator';

/** Mounted at /api/projects/:projectId/deployment (Phase 13 spec §34). */
export const deploymentRouter = Router({ mergeParams: true });

deploymentRouter.use(requireAuth, loadUser);

deploymentRouter.get('/config', validate(environmentQuerySchema, 'query'), deploymentConfigController.getConfig);
deploymentRouter.get('/configs', deploymentConfigController.listConfigs);
deploymentRouter.put(
  '/config',
  deploymentRateLimiter,
  validate(deploymentConfigSchema),
  deploymentConfigController.upsertConfig
);

deploymentRouter.post('/validate', validate(createDeploymentSchema), deploymentController.validateDeployment);
deploymentRouter.post(
  '/deploy',
  deploymentRateLimiter,
  validate(createDeploymentSchema),
  deploymentController.createDeployment
);
deploymentRouter.get('/history', validate(deploymentHistoryQuerySchema, 'query'), deploymentController.listHistory);
deploymentRouter.get('/:deploymentId', validateObjectId('deploymentId'), deploymentController.getDeployment);
deploymentRouter.get(
  '/:deploymentId/events',
  validateObjectId('deploymentId'),
  deploymentController.streamDeploymentEvents
);
deploymentRouter.post(
  '/:deploymentId/cancel',
  validateObjectId('deploymentId'),
  deploymentController.cancelDeployment
);
deploymentRouter.post(
  '/:deploymentId/rollback',
  deploymentRateLimiter,
  validateObjectId('deploymentId'),
  deploymentController.rollbackDeployment
);

/** Mounted at /api/projects/:projectId/environment-variables (Phase 13 spec §34). */
export const environmentVariableRouter = Router({ mergeParams: true });

environmentVariableRouter.use(requireAuth, loadUser);

environmentVariableRouter.get(
  '/',
  validate(environmentQuerySchema, 'query'),
  environmentVariableController.listVariables
);
environmentVariableRouter.post(
  '/',
  deploymentRateLimiter,
  validate(createEnvironmentVariableSchema),
  environmentVariableController.createVariable
);
environmentVariableRouter.get(
  '/:id/reveal',
  validateObjectId('id'),
  environmentVariableController.revealVariable
);
environmentVariableRouter.patch(
  '/:id',
  validateObjectId('id'),
  validate(updateEnvironmentVariableSchema),
  environmentVariableController.updateVariable
);
environmentVariableRouter.delete('/:id', validateObjectId('id'), environmentVariableController.deleteVariable);

export default deploymentRouter;
