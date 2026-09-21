import { createHmac } from 'node:crypto';
import { DeploymentEnvironment } from 'shared';
import { env } from '../../config/env';
import { ProjectModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { safeEqual } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import { createWebhookDeployment } from './deployment.service';

/** Verifies GitHub's `X-Hub-Signature-256` header (spec §19 — never trust an arbitrary webhook
 *  request). `rawBody` must be the untouched request body bytes, matching exactly what GitHub
 *  signed — this is why `webhook.routes.ts` mounts this route with `express.raw()` instead of the
 *  global JSON parser, same reasoning as the existing Clerk/Svix webhook. */
export function verifyGithubWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): void {
  if (!env.GITHUB_WEBHOOK_SECRET) {
    throw ApiError.badRequest('GitHub webhooks are not configured on this server.');
  }
  if (!signatureHeader) {
    throw ApiError.badRequest('Missing X-Hub-Signature-256 header.');
  }

  const expected = `sha256=${createHmac('sha256', env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
  if (!safeEqual(signatureHeader, expected)) {
    throw ApiError.unauthorized('Invalid webhook signature.');
  }
}

interface GithubPushPayload {
  ref: string;
  after: string;
  repository: { full_name: string };
}

interface GithubPullRequestPayload {
  action: string;
  number: number;
  pull_request: { head: { sha: string; ref: string }; base: { ref: string } };
  repository: { full_name: string };
}

const ZERO_SHA = '0000000000000000000000000000000000000000';
const PR_DEPLOY_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

/** Finds every Mingo project connected to this repository — ownership doesn't matter here (unlike
 *  every other deployment call, which is scoped to `req.dbUser`): the webhook is server-to-server,
 *  authorized by the verified signature, not a signed-in user, and more than one Mingo user could in
 *  principle have connected the same public repository. */
async function findConnectedProjects(repositoryFullName: string) {
  return ProjectModel.find({ 'github.connected': true, 'github.repositoryFullName': repositoryFullName });
}

export async function handlePushEvent(payload: GithubPushPayload): Promise<void> {
  if (payload.after === ZERO_SHA) return; // branch deletion, nothing to deploy

  const branchMatch = /^refs\/heads\/(.+)$/.exec(payload.ref);
  if (!branchMatch) return; // tag push or similar — not a branch we deploy

  const branch = branchMatch[1];
  const projects = await findConnectedProjects(payload.repository.full_name);

  for (const project of projects) {
    for (const environment of Object.values(DeploymentEnvironment)) {
      await createWebhookDeployment(project.owner, project.id as string, {
        environment,
        branch,
        commitSha: payload.after,
      }).catch((err) => {
        logger.error('github_webhook.push_deploy_failed', {
          projectId: project.id,
          environment,
          error: err instanceof Error ? err.message : err,
        });
      });
    }
  }
}

export async function handlePullRequestEvent(payload: GithubPullRequestPayload): Promise<void> {
  if (!PR_DEPLOY_ACTIONS.has(payload.action)) return;

  const projects = await findConnectedProjects(payload.repository.full_name);

  for (const project of projects) {
    await createWebhookDeployment(project.owner, project.id as string, {
      environment: DeploymentEnvironment.PREVIEW,
      branch: payload.pull_request.head.ref,
      commitSha: payload.pull_request.head.sha,
      pullRequestNumber: payload.number,
    }).catch((err) => {
      logger.error('github_webhook.pr_deploy_failed', {
        projectId: project.id,
        prNumber: payload.number,
        error: err instanceof Error ? err.message : err,
      });
    });
  }
}
