import { Router } from 'express';
import { settingsController } from '../controllers';
import { loadUser, requireAuth, validate, writeRateLimiter } from '../middlewares';
import { updateSettingsSchema } from '../validators';

const router = Router();

router.use(requireAuth, loadUser);

router.get('/', settingsController.getSettings);
router.put('/', writeRateLimiter, validate(updateSettingsSchema), settingsController.updateSettings);

export default router;
