import { Router } from 'express';
import { projectController } from '../controllers';
import { loadUser, requireAuth, validate, validateObjectId, writeRateLimiter } from '../middlewares';
import { createProjectSchema, projectQuerySchema, updateProjectSchema } from '../validators';

const router = Router();

router.use(requireAuth, loadUser);

router.get('/', validate(projectQuerySchema, 'query'), projectController.getProjects);
router.post('/', writeRateLimiter, validate(createProjectSchema), projectController.createProject);
router.get('/:id', validateObjectId(), projectController.getProject);
router.put(
  '/:id',
  validateObjectId(),
  writeRateLimiter,
  validate(updateProjectSchema),
  projectController.updateProject
);
router.delete('/:id', validateObjectId(), writeRateLimiter, projectController.deleteProject);
router.patch('/:id/archive', validateObjectId(), writeRateLimiter, projectController.archiveProject);
router.post(
  '/:id/duplicate',
  validateObjectId(),
  writeRateLimiter,
  projectController.duplicateProject
);

export default router;
