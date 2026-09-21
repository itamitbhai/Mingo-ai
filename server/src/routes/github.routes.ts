import { Router } from 'express';
import { createGitBranchSchema, createGithubRepoSchema, githubRepositoryQuerySchema } from 'shared';
import { githubController } from '../controllers';
import { githubRateLimiter, loadUser, requireAuth, validate } from '../middlewares';

/**
 * Mounted at /api/github (Phase 12 spec §25). Unlike every other router in this codebase, auth is
 * applied per-route rather than with a blanket `router.use(requireAuth, loadUser)` — `/callback` is
 * a plain browser redirect from github.com with no Clerk session attached, so it must stay
 * reachable without auth; every other route here still requires one.
 */
export const githubRouter = Router();

githubRouter.get('/connect', requireAuth, loadUser, githubController.connect);
githubRouter.get('/callback', githubController.callback);
githubRouter.get('/status', requireAuth, loadUser, githubController.getStatus);
githubRouter.post('/disconnect', requireAuth, loadUser, githubController.disconnect);

githubRouter.get(
  '/repositories',
  requireAuth,
  loadUser,
  githubRateLimiter,
  validate(githubRepositoryQuerySchema, 'query'),
  githubController.listRepositories
);
githubRouter.post(
  '/repositories',
  requireAuth,
  loadUser,
  githubRateLimiter,
  validate(createGithubRepoSchema),
  githubController.createRepository
);
githubRouter.get('/repositories/:id', requireAuth, loadUser, githubRateLimiter, githubController.getRepository);
githubRouter.get(
  '/repositories/:id/branches',
  requireAuth,
  loadUser,
  githubRateLimiter,
  githubController.listBranches
);
githubRouter.post(
  '/repositories/:id/branches',
  requireAuth,
  loadUser,
  githubRateLimiter,
  validate(createGitBranchSchema),
  githubController.createBranchOnRepo
);

export default githubRouter;
