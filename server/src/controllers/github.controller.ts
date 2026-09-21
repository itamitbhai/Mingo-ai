import { Request, Response } from 'express';
import {
  CreateGitBranchInput,
  CreateGithubRepoInput,
  GithubRepositoryQueryInput,
} from 'shared';
import * as githubAuthService from '../services/github/githubAuth.service';
import * as githubRepositoryService from '../services/github/githubRepository.service';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';
import { githubCallbackQuerySchema } from '../validators/github.validator';

export const connect = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const authorizeUrl = githubAuthService.buildAuthorizeUrl(user._id);
  sendSuccess(res, { authorizeUrl });
});

/**
 * Not behind `requireAuth`/`loadUser` (see `routes/github.routes.ts`) — this is a plain top-level
 * browser redirect from github.com, carrying no Clerk session. Identity is recovered from the
 * signed `state` inside `handleCallback`. Always redirects back to the client rather than
 * returning JSON, and always redirects even on failure, so the user lands somewhere sensible
 * instead of a bare error page (spec §35).
 */
export const callback = asyncHandler(async (req: Request, res: Response) => {
  const parsed = githubCallbackQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    logger.error('github.oauth.callback_invalid_query');
    return res.redirect(`${env.CLIENT_URL}/settings?tab=integrations&github=error`);
  }

  try {
    await githubAuthService.handleCallback(parsed.data.code, parsed.data.state);
    res.redirect(`${env.CLIENT_URL}/settings?tab=integrations&github=connected`);
  } catch (err) {
    logger.error('github.oauth.callback_failed', { error: err instanceof Error ? err.message : err });
    res.redirect(`${env.CLIENT_URL}/settings?tab=integrations&github=error`);
  }
});

export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const status = await githubAuthService.getStatus(user._id);
  sendSuccess(res, status);
});

export const disconnect = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  await githubAuthService.disconnect(user._id);
  sendSuccess(res, { disconnected: true }, 'GitHub disconnected');
});

export const listRepositories = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const query = req.query as unknown as GithubRepositoryQueryInput;
  const result = await githubRepositoryService.listRepositories(user._id, query);
  sendSuccess(res, result);
});

export const getRepository = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const repo = await githubRepositoryService.getRepository(user._id, req.params.id);
  sendSuccess(res, repo);
});

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const branches = await githubRepositoryService.listBranches(user._id, req.params.id);
  sendSuccess(res, branches);
});

export const createBranchOnRepo = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateGitBranchInput;
  const branch = await githubRepositoryService.createBranchOnRepo(user._id, req.params.id, body.name, body.fromBranch);
  sendCreated(res, branch, `Branch "${body.name}" created`);
});

export const createRepository = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as CreateGithubRepoInput;
  const repo = await githubRepositoryService.createRepository(user._id, body);
  sendCreated(res, repo, `Repository "${repo.fullName}" created`);
});
