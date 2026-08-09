import { Router } from 'express';
import { workspaceController } from '../controllers';
import {
  loadUser,
  requireAuth,
  validate,
  validateObjectId,
  workspaceBulkRateLimiter,
  writeRateLimiter,
} from '../middlewares';
import {
  activityQuerySchema,
  batchOperationsSchema,
  createSnapshotSchema,
  moveEntrySchema,
  snapshotsQuerySchema,
  versionsQuerySchema,
} from '../validators';

/** Mounted at /api/projects/:projectId/workspace */
export const workspaceRouter = Router({ mergeParams: true });

workspaceRouter.use(requireAuth, loadUser);

workspaceRouter.get('/', workspaceController.getWorkspace);
workspaceRouter.get('/tree', workspaceController.getTree);
workspaceRouter.get('/manifest', workspaceController.getManifest);
workspaceRouter.get('/activity', validate(activityQuerySchema, 'query'), workspaceController.getActivity);

workspaceRouter.get(
  '/snapshots',
  validate(snapshotsQuerySchema, 'query'),
  workspaceController.listSnapshots
);
workspaceRouter.post(
  '/snapshots',
  writeRateLimiter,
  validate(createSnapshotSchema),
  workspaceController.createSnapshot
);
workspaceRouter.post(
  '/snapshots/:snapshotId/restore',
  validateObjectId('snapshotId'),
  workspaceBulkRateLimiter,
  workspaceController.restoreSnapshot
);

workspaceRouter.post(
  '/preview',
  writeRateLimiter,
  validate(batchOperationsSchema),
  workspaceController.previewOperations
);
workspaceRouter.post(
  '/batch',
  workspaceBulkRateLimiter,
  validate(batchOperationsSchema),
  workspaceController.applyBatch
);

workspaceRouter.patch(
  '/move',
  writeRateLimiter,
  validate(moveEntrySchema),
  workspaceController.moveEntryHandler
);

workspaceRouter.get('/versions', validate(versionsQuerySchema, 'query'), workspaceController.listVersions);
workspaceRouter.get(
  '/versions/:versionId',
  validateObjectId('versionId'),
  workspaceController.getVersion
);

export default workspaceRouter;
