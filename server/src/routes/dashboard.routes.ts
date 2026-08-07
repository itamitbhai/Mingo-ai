import { Router } from 'express';
import { dashboardController } from '../controllers';
import { loadUser, requireAuth } from '../middlewares';

const router = Router();

router.use(requireAuth, loadUser);

router.get('/overview', dashboardController.getOverview);

export default router;
