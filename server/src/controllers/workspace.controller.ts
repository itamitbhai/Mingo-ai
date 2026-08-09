import { Request, Response } from 'express';
import {
  ActivityQueryInput,
  BatchOperationsInput,
  CreateSnapshotInput,
  MoveEntryInput,
  SnapshotsQueryInput,
  VersionsQueryInput,
} from 'shared';
import * as fileService from '../services/files/file.service';
import * as fileTreeService from '../services/files/file-tree.service';
import { getProjectById } from '../services/project.service';
import * as batchService from '../services/workspace/batch.service';
import { workspaceCache } from '../services/workspace/cache.service';
import { moveEntry } from '../services/workspace/move.service';
import * as previewService from '../services/workspace/preview.service';
import * as snapshotService from '../services/workspace/snapshot.service';
import * as versionService from '../services/workspace/version.service';
import * as workspaceActivityService from '../services/workspace/workspace-activity.service';
import * as workspaceService from '../services/workspace/workspace.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const workspace = await workspaceService.getWorkspace(user._id, req.params.projectId);
  sendSuccess(res, workspace);
});

export const getTree = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const projectId = req.params.projectId;
  const cacheKey = `${projectId}:tree`;

  const cached = workspaceCache.get(cacheKey);
  if (cached) {
    sendSuccess(res, cached);
    return;
  }

  const tree = await fileTreeService.getFileTree(user._id, projectId);
  workspaceCache.set(cacheKey, tree);
  sendSuccess(res, tree);
});

export const getManifest = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const projectId = req.params.projectId;
  const cacheKey = `${projectId}:manifest`;

  const cached = workspaceCache.get(cacheKey);
  if (cached) {
    sendSuccess(res, cached);
    return;
  }

  const manifest = await workspaceService.getManifest(user._id, projectId);
  workspaceCache.set(cacheKey, manifest);
  sendSuccess(res, manifest);
});

export const getActivity = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as ActivityQueryInput;
  const project = await getProjectById(user._id, req.params.projectId);

  const result = await workspaceActivityService.listActivity(
    project._id,
    user._id,
    query.cursor,
    query.limit
  );

  sendSuccess(res, result);
});

export const listSnapshots = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as SnapshotsQueryInput;
  const result = await snapshotService.listSnapshots(user._id, req.params.projectId, query.page, query.limit);
  sendSuccess(res, result);
});

export const createSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateSnapshotInput;
  const snapshot = await snapshotService.createSnapshot(
    user._id,
    req.params.projectId,
    body.name,
    body.description,
    user._id
  );
  sendCreated(res, snapshot, 'Snapshot created');
});

export const restoreSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const result = await snapshotService.restoreSnapshot(
    user._id,
    req.params.projectId,
    req.params.snapshotId
  );
  sendSuccess(res, result, 'Snapshot restored');
});

export const previewOperations = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as BatchOperationsInput;
  const preview = await previewService.previewOperations(user._id, req.params.projectId, body.operations);
  sendSuccess(res, preview);
});

export const applyBatch = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as BatchOperationsInput;
  const result = await batchService.applyBatch(user._id, req.params.projectId, body.operations);
  sendSuccess(res, result, 'Batch applied');
});

export const moveEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as MoveEntryInput;
  const { entry } = await moveEntry(user._id, req.params.projectId, body.path, body.destinationPath);
  sendSuccess(res, entry, 'Moved successfully');
});

export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as VersionsQueryInput;
  const project = await getProjectById(user._id, req.params.projectId);
  const file = await fileService.getFileContent(user._id, req.params.projectId, query.path);

  const result = await versionService.listVersions(user._id, project._id, file._id, query.cursor, query.limit);
  sendSuccess(res, result);
});

export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const project = await getProjectById(user._id, req.params.projectId);
  const version = await versionService.getVersion(user._id, project._id, req.params.versionId);
  sendSuccess(res, version);
});
