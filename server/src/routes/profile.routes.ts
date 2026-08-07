import { Router } from 'express';
import { profileController } from '../controllers';
import { loadUser, requireAuth, validate, writeRateLimiter } from '../middlewares';
import { updateProfileSchema } from '../validators';

const router = Router();

router.use(requireAuth, loadUser);

router.get('/', profileController.getProfile);
router.put('/', writeRateLimiter, validate(updateProfileSchema), profileController.updateProfile);
router.delete('/', writeRateLimiter, profileController.deleteAccount);

export default router;
