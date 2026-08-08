import { Request, Response } from 'express';
import {
  CreateFileInput,
  CreateFolderInput,
  DeleteEntryInput,
  FileContentQueryInput,
  FileSearchQueryInput,
  RenameEntryInput,
  UpdateFileContentInput,
} from 'shared';
import * as fileTreeService from '../services/files/file-tree.service';
import * as fileService from '../services/files/file.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getFileTree = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const tree = await fileTreeService.getFileTree(user._id, req.params.projectId);
  sendSuccess(res, tree);
});

export const getFileContent = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as FileContentQueryInput;
  const file = await fileService.getFileContent(user._id, req.params.projectId, query.path);
  sendSuccess(res, file);
});

export const createFile = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateFileInput;
  const file = await fileService.createFile(user._id, req.params.projectId, body.path, body.content);
  sendCreated(res, file, 'File created');
});

export const createFolder = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateFolderInput;
  const folder = await fileService.createFolder(user._id, req.params.projectId, body.path);
  sendCreated(res, folder, 'Folder created');
});

export const updateFileContent = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as UpdateFileContentInput;
  const file = await fileService.updateFileContent(
    user._id,
    req.params.projectId,
    body.path,
    body.content,
    body.expectedVersion
  );
  sendSuccess(res, file, 'File saved');
});

export const renameEntry = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as RenameEntryInput;
  const entry = await fileService.renameEntry(user._id, req.params.projectId, body.path, body.newName);
  sendSuccess(res, entry, 'Renamed successfully');
});

export const deleteEntry = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as DeleteEntryInput;
  await fileService.deleteEntry(user._id, req.params.projectId, body.path);
  sendSuccess(res, null, 'Deleted successfully');
});

export const searchFiles = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as FileSearchQueryInput;
  const results = await fileService.searchFiles(user._id, req.params.projectId, query.q);
  sendSuccess(res, results);
});
