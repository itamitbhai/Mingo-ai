import { Router } from 'express';
import projectRoutes from './project.routes';
import profileRoutes from './profile.routes';
import settingsRoutes from './settings.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/projects', projectRoutes);
router.use('/profile', profileRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
