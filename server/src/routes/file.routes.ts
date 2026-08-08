import { Router } from 'express';
import { fileController } from '../controllers';
import { loadUser, requireAuth, validate, writeRateLimiter } from '../middlewares';
import {
  createFileSchema,
  createFolderSchema,
  deleteEntrySchema,
  fileContentQuerySchema,
  fileSearchQuerySchema,
  renameEntrySchema,
  updateFileContentSchema,
} from '../validators';

/** Mounted at /api/projects/:projectId/files */
export const fileRouter = Router({ mergeParams: true });

fileRouter.use(requireAuth, loadUser);
fileRouter.get('/', fileController.getFileTree);
fileRouter.get('/content', validate(fileContentQuerySchema, 'query'), fileController.getFileContent);
fileRouter.get('/search', validate(fileSearchQuerySchema, 'query'), fileController.searchFiles);
fileRouter.post('/', writeRateLimiter, validate(createFileSchema), fileController.createFile);
fileRouter.patch(
  '/',
  writeRateLimiter,
  validate(updateFileContentSchema),
  fileController.updateFileContent
);
fileRouter.patch('/rename', writeRateLimiter, validate(renameEntrySchema), fileController.renameEntry);
fileRouter.delete('/', writeRateLimiter, validate(deleteEntrySchema), fileController.deleteEntry);

/** Mounted at /api/projects/:projectId/folders */
export const folderRouter = Router({ mergeParams: true });

folderRouter.use(requireAuth, loadUser);
folderRouter.post('/', writeRateLimiter, validate(createFolderSchema), fileController.createFolder);
