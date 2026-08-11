import { Router } from 'express';
import projectRoutes from './project.routes';
import profileRoutes from './profile.routes';
import settingsRoutes from './settings.routes';
import dashboardRoutes from './dashboard.routes';
import { conversationsRouter, projectConversationsRouter } from './conversation.routes';
import { fileRouter, folderRouter } from './file.routes';
import { workspaceRouter } from './workspace.routes';
import { planRouter } from './plan.routes';
import { taskRouter } from './task.routes';
import { frontendAgentRouter } from './frontend-agent.routes';
import { autopilotRouter } from './autopilot.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/projects', projectRoutes);
router.use('/projects/:projectId/conversations', projectConversationsRouter);
router.use('/projects/:projectId/files', fileRouter);
router.use('/projects/:projectId/folders', folderRouter);
router.use('/projects/:projectId/workspace/ai', frontendAgentRouter);
router.use('/projects/:projectId/workspace', workspaceRouter);
router.use('/projects/:projectId/plans', planRouter);
router.use('/projects/:projectId/plans/:planId/tasks', taskRouter);
router.use('/projects/:projectId/autopilot', autopilotRouter);
router.use('/profile', profileRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/conversations', conversationsRouter);

export default router;
