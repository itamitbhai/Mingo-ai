import { Request, Response } from 'express';
import { CreateProjectInput, ProjectQueryInput, UpdateProjectInput } from 'shared';
import * as projectService from '../services/project.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as ProjectQueryInput;

  const result = await projectService.listProjects(user._id, query);
  sendSuccess(res, result);
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const project = await projectService.getProjectById(user._id, req.params.id);
  sendSuccess(res, project);
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateProjectInput;

  const project = await projectService.createProject(user._id, body);
  sendCreated(res, project, 'Project created successfully');
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as UpdateProjectInput;

  const project = await projectService.updateProject(user._id, req.params.id, body);
  sendSuccess(res, project, 'Project updated successfully');
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  await projectService.deleteProject(user._id, req.params.id);
  sendSuccess(res, null, 'Project deleted successfully');
});

export const archiveProject = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const project = await projectService.archiveProject(user._id, req.params.id);
  sendSuccess(res, project, 'Project status updated');
});

export const duplicateProject = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const project = await projectService.duplicateProject(user._id, req.params.id);
  sendCreated(res, project, 'Project duplicated successfully');
});
