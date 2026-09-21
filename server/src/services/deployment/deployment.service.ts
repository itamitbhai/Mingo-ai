import { FilterQuery, Types } from 'mongoose';
import {
  ActivityType,
  CreateDeploymentInput,
  DeploymentEnvironment,
  DeploymentEventType,
  DeploymentStage,
  DeploymentStatus,
  DeploymentTrigger,
  HealthCheckStatus,
} from 'shared';
import { DeploymentConfigModel, DeploymentDocument, DeploymentModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta } from '../../utils/paginate';
import { logger } from '../../utils/logger';
import { logActivity } from '../activity.service';
import { getProjectById } from '../project.service';
import { getDecryptedEnvironmentVariables } from '../environmentVariable.service';
import { assertDockerAvailable, ensureNodeModulesVolume, getDockerClient } from '../../sandbox/sandbox.manager';
import { assertWithinDiskLimit, prepareSandboxWorkspace, SandboxWorkspace } from '../../sandbox/sandbox.filesystem';
import { ensureImage } from '../../sandbox/sandbox.image';
import { ensureSandboxNetwork } from '../../sandbox/sandbox.network';
import { runInContainer } from '../../sandbox/sandbox.executor';
import { parseCommandLine } from '../../sandbox/sandbox.security';
import { sandboxConfig } from '../../sandbox/sandbox.config';
import { checkDrift } from './githubDriftCheck.service';
import { publish } from './deployment.events';
import { getProvider } from './providers';
import { ProviderDeployHandle } from './providers/deploymentProvider.interface';

const MAX_LOG_CHARS = 200_000;
const NON_TERMINAL_STATUSES: DeploymentStatus[] = [
  DeploymentStatus.QUEUED,
  DeploymentStatus.PENDING,
  DeploymentStatus.RUNNING,
  DeploymentStatus.BUILDING,
];
const PROVIDER_POLL_INTERVAL_MS = 5000;
const PROVIDER_DEPLOY_TIMEOUT_MS = 15 * 60 * 1000;
const HEALTH_CHECK_RETRY_DELAY_MS = 3000;

/** Same in-memory registry precedent as `sandbox.service.ts`'s `activeSandboxes` /
 *  `orchestrator.ts`'s workflow registry — keyed by `Deployment` id so a separate cancel request can
 *  find the running pipeline's `AbortController`. */
const activeDeployments = new Map<string, AbortController>();

export function isDeploymentActive(deploymentId: string): boolean {
  return activeDeployments.has(deploymentId);
}

function appendLog(current: string, chunk: string): string {
  return (current + chunk).slice(-MAX_LOG_CHARS);
}

async function getDeploymentOrThrow(owner: Types.ObjectId, projectId: string, deploymentId: string): Promise<DeploymentDocument> {
  if (!Types.ObjectId.isValid(deploymentId)) {
    throw ApiError.badRequest('Invalid deployment id');
  }
  const project = await getProjectById(owner, projectId);
  const deployment = await DeploymentModel.findOne({ _id: deploymentId, project: project._id });
  if (!deployment) {
    throw ApiError.notFound('Deployment not found');
  }
  return deployment;
}

export async function getDeployment(owner: Types.ObjectId, projectId: string, deploymentId: string) {
  return getDeploymentOrThrow(owner, projectId, deploymentId);
}

export async function listDeploymentHistory(
  owner: Types.ObjectId,
  projectId: string,
  query: { environment?: string; page: number; limit: number }
) {
  const project = await getProjectById(owner, projectId);
  const filter: Record<string, unknown> = { project: project._id };
  if (query.environment) filter.environment = query.environment;

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    DeploymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    DeploymentModel.countDocuments(filter),
  ]);

  return { items, pagination: buildPaginationMeta(total, query.page, query.limit) };
}

function publishStage(deploymentId: string, type: DeploymentEventType, stage: DeploymentStage, message: string) {
  publish(deploymentId, { type, stage, message });
}

/**
 * The detached pipeline run (Phase 13 spec §11) — reuses the exact same primitives the Testing Agent
 * / Terminal sandbox already use (`prepareSandboxWorkspace`, `runInContainer`, `ensureImage`,
 * `ensureNodeModulesVolume`, `ensureSandboxNetwork`) for a real install → test → build pre-flight
 * pass, then hands off to the resolved `DeploymentProvider` for the actual remote deploy, then runs
 * a real HTTP health check before ever marking the run `SUCCESS` (spec §7/§25 — non-negotiable).
 */
async function runDeploymentPipeline(deploymentId: string, owner: Types.ObjectId, projectId: string): Promise<void> {
  const controller = new AbortController();
  activeDeployments.set(deploymentId, controller);

  let workspace: SandboxWorkspace | null = null;
  const docker = getDockerClient();

  const fail = async (deployment: DeploymentDocument, stage: DeploymentStage, error: string) => {
    deployment.status = DeploymentStatus.FAILED;
    deployment.stage = stage;
    deployment.error = error.slice(0, 2000);
    deployment.completedAt = new Date();
    await deployment.save();
    await logActivity(owner, ActivityType.DEPLOYMENT_FAILED, `Deployment failed at "${stage}": ${error}`, {
      projectId,
      deploymentId,
    });
    publish(deploymentId, { type: DeploymentEventType.FAILED, stage, message: error });
  };

  try {
    const deployment = await DeploymentModel.findById(deploymentId);
    if (!deployment) return;

    const config = await DeploymentConfigModel.findOne({ project: deployment.project, environment: deployment.environment });
    if (!config) {
      await fail(deployment, DeploymentStage.VALIDATING, 'Deployment configuration was removed before this run started.');
      return;
    }

    const provider = getProvider(config.provider);

    // --- validating -------------------------------------------------------
    deployment.status = DeploymentStatus.RUNNING;
    deployment.stage = DeploymentStage.VALIDATING;
    deployment.startedAt = new Date();
    await deployment.save();
    publishStage(deploymentId, DeploymentEventType.VALIDATION, DeploymentStage.VALIDATING, 'Validating deployment configuration…');

    if (!provider.isConfigured()) {
      await fail(deployment, DeploymentStage.VALIDATING, `The ${config.provider} provider is not configured.`);
      return;
    }

    const buildParsed = parseCommandLine(config.buildCommand);
    if (!buildParsed.success) {
      await fail(deployment, DeploymentStage.VALIDATING, `Invalid build command: ${buildParsed.error}`);
      return;
    }
    const testParsed = config.testCommand ? parseCommandLine(config.testCommand) : null;
    if (config.testCommand && !testParsed?.success) {
      await fail(deployment, DeploymentStage.VALIDATING, `Invalid test command: ${testParsed && 'error' in testParsed ? testParsed.error : 'unknown error'}`);
      return;
    }

    const skipLocalBuild = deployment.triggeredBy !== DeploymentTrigger.MANUAL;

    if (skipLocalBuild) {
      const reason =
        deployment.triggeredBy === DeploymentTrigger.ROLLBACK
          ? `Rolling back to commit ${deployment.commitHash?.slice(0, 7) ?? 'unknown'}`
          : `Deploying pushed commit ${deployment.commitHash?.slice(0, 7) ?? 'unknown'} from GitHub`;
      publishStage(
        deploymentId,
        DeploymentEventType.DEPLOYING,
        DeploymentStage.DEPLOYING,
        `${reason} — skipping the local rebuild and letting the provider build that exact commit directly from GitHub.`
      );
    } else {
      // --- installing ---------------------------------------------------------
      await assertDockerAvailable();
      await ensureImage(docker);
      await ensureNodeModulesVolume(projectId);
      await ensureSandboxNetwork(docker);

      deployment.stage = DeploymentStage.INSTALLING;
      await deployment.save();
      publishStage(deploymentId, DeploymentEventType.INSTALL, DeploymentStage.INSTALLING, 'Installing dependencies…');

      workspace = await prepareSandboxWorkspace(owner, projectId);

      const onOutput = (chunk: string, stream: 'stdout' | 'stderr') => {
        deployment.buildLogs = appendLog(deployment.buildLogs, chunk);
        publish(deploymentId, {
          type: DeploymentEventType.BUILD,
          stage: deployment.stage,
          message: stream === 'stdout' ? 'output' : 'error output',
          chunk,
        });
      };

      const installResult = await runInContainer(docker, {
        command: 'npm',
        args: ['install'],
        workspaceDir: workspace.dir,
        projectId,
        workingDir: config.rootDirectory || undefined,
        networkMode: 'install',
        timeoutMs: sandboxConfig.INSTALL_TIMEOUT_MS,
        sandboxId: deploymentId,
        signal: controller.signal,
        onOutput,
      });

      await deployment.save();
      if (installResult.exitCode !== 0 || installResult.timedOut || installResult.cancelled) {
        await fail(
          deployment,
          DeploymentStage.INSTALLING,
          installResult.timedOut
            ? 'Dependency installation timed out.'
            : installResult.cancelled
              ? 'Deployment was cancelled during installation.'
              : `"npm install" exited with code ${installResult.exitCode}.`
        );
        return;
      }

      // --- testing --------------------------------------------------------
      if (testParsed?.success) {
        deployment.stage = DeploymentStage.TESTING;
        await deployment.save();
        publishStage(deploymentId, DeploymentEventType.TEST, DeploymentStage.TESTING, 'Running tests…');

        const testResult = await runInContainer(docker, {
          command: testParsed.data.command,
          args: testParsed.data.args,
          workspaceDir: workspace.dir,
          projectId,
          workingDir: config.rootDirectory || undefined,
          networkMode: 'none',
          timeoutMs: sandboxConfig.TIMEOUT_MS,
          sandboxId: deploymentId,
          signal: controller.signal,
          onOutput,
        });

        await deployment.save();
        if (testResult.exitCode !== 0 || testResult.timedOut || testResult.cancelled) {
          await fail(
            deployment,
            DeploymentStage.TESTING,
            testResult.timedOut ? 'Tests timed out.' : `Tests failed (exit code ${testResult.exitCode}).`
          );
          return;
        }
      }

      // --- building ---------------------------------------------------------
      deployment.stage = DeploymentStage.BUILDING;
      await deployment.save();
      publishStage(deploymentId, DeploymentEventType.BUILD, DeploymentStage.BUILDING, 'Building production bundle…');

      const buildResult = await runInContainer(docker, {
        command: buildParsed.data.command,
        args: buildParsed.data.args,
        workspaceDir: workspace.dir,
        projectId,
        workingDir: config.rootDirectory || undefined,
        networkMode: 'none',
        timeoutMs: sandboxConfig.TIMEOUT_MS,
        sandboxId: deploymentId,
        signal: controller.signal,
        onOutput,
      });

      await deployment.save();
      if (buildResult.exitCode !== 0 || buildResult.timedOut || buildResult.cancelled) {
        await fail(
          deployment,
          DeploymentStage.BUILDING,
          buildResult.timedOut ? 'Build timed out.' : `Build command exited with code ${buildResult.exitCode}.`
        );
        return;
      }

      await assertWithinDiskLimit(workspace.dir).catch((err) => {
        logger.warn('deployment.service.disk_limit_note', { deploymentId, error: err instanceof Error ? err.message : err });
      });
    }

    // --- deploying (real provider) -----------------------------------------
    deployment.stage = DeploymentStage.DEPLOYING;
    await deployment.save();
    publishStage(deploymentId, DeploymentEventType.DEPLOYING, DeploymentStage.DEPLOYING, `Deploying via ${config.provider}…`);

    const project = await getProjectById(owner, projectId);
    if (!project.github?.repositoryFullName) {
      await fail(deployment, DeploymentStage.DEPLOYING, 'Project is no longer connected to a GitHub repository.');
      return;
    }

    const envVars = await getDecryptedEnvironmentVariables(owner, projectId, deployment.environment);

    // PR previews get their own Render service per PR number so concurrent PRs don't overwrite each
    // other's preview (spec §20's "isolated from production" — and from each other).
    const serviceNameSuffix = deployment.pullRequestNumber ? `-pr${deployment.pullRequestNumber}` : '';
    const handle: ProviderDeployHandle = await provider.deploy({
      serviceName: `mingo-${projectId}-${deployment.environment}${serviceNameSuffix}`.toLowerCase(),
      isStaticSite: config.serviceType === 'static_site',
      repoUrl: `https://github.com/${project.github.repositoryFullName}`,
      branch: deployment.branch,
      rootDirectory: config.rootDirectory,
      buildCommand: config.buildCommand,
      startCommand: config.startCommand,
      outputDirectory: config.outputDirectory,
      healthCheckPath: config.healthCheck.path,
      envVars,
      commitId: skipLocalBuild ? deployment.commitHash : undefined,
    });

    deployment.providerServiceId = handle.providerServiceId;
    deployment.providerDeployId = handle.providerDeployId;
    await deployment.save();

    const deployStartedAt = Date.now();
    let providerPhase: 'queued' | 'in_progress' | 'live' | 'failed' | 'cancelled' = 'queued';

    while (Date.now() - deployStartedAt < PROVIDER_DEPLOY_TIMEOUT_MS) {
      if (controller.signal.aborted) {
        await provider.cancelDeployment(handle).catch(() => undefined);
        await fail(deployment, DeploymentStage.DEPLOYING, 'Deployment was cancelled.');
        return;
      }

      const status = await provider.getDeploymentStatus(handle);
      providerPhase = status.phase;
      deployment.deploymentLogs = appendLog(deployment.deploymentLogs, `[${config.provider}] ${status.rawStatus}\n`);
      await deployment.save();
      publish(deploymentId, {
        type: DeploymentEventType.DEPLOYING,
        stage: DeploymentStage.DEPLOYING,
        message: `Provider status: ${status.rawStatus}`,
      });

      if (providerPhase === 'live' || providerPhase === 'failed' || providerPhase === 'cancelled') break;
      await new Promise((resolve) => setTimeout(resolve, PROVIDER_POLL_INTERVAL_MS));
    }

    if (providerPhase !== 'live') {
      await fail(
        deployment,
        DeploymentStage.DEPLOYING,
        providerPhase === 'cancelled' ? 'The provider cancelled this deployment.' : `${config.provider} reported the deployment failed.`
      );
      return;
    }

    const liveUrl = await provider.getLiveUrl(handle.providerServiceId);
    deployment.url = liveUrl ?? deployment.url;
    await deployment.save();

    // --- health_checking ------------------------------------------------
    deployment.stage = DeploymentStage.HEALTH_CHECKING;
    await deployment.save();
    publishStage(deploymentId, DeploymentEventType.HEALTHCHECK, DeploymentStage.HEALTH_CHECKING, 'Running health check…');

    const passed = await runHealthCheck(liveUrl, config.healthCheck);

    deployment.healthCheck = {
      status: passed.ok ? HealthCheckStatus.PASSED : HealthCheckStatus.FAILED,
      checkedAt: new Date(),
      statusCode: passed.statusCode,
    };

    if (!passed.ok) {
      await fail(deployment, DeploymentStage.HEALTH_CHECKING, passed.reason ?? 'Health check failed.');
      return;
    }

    deployment.status = DeploymentStatus.SUCCESS;
    deployment.stage = DeploymentStage.COMPLETE;
    deployment.completedAt = new Date();
    await deployment.save();

    await logActivity(owner, ActivityType.DEPLOYMENT_SUCCEEDED, `Deployed "${projectId}" to ${deployment.environment}`, {
      projectId,
      deploymentId,
      url: liveUrl,
    });
    publish(deploymentId, { type: DeploymentEventType.SUCCESS, stage: DeploymentStage.COMPLETE, message: 'Deployment successful.' });
  } catch (err) {
    logger.error('deployment.service.pipeline_failed', { deploymentId, error: err instanceof Error ? err.message : err });
    const deployment = await DeploymentModel.findById(deploymentId);
    if (deployment && NON_TERMINAL_STATUSES.includes(deployment.status)) {
      await fail(deployment, deployment.stage ?? DeploymentStage.PREPARING, err instanceof Error ? err.message : 'Deployment failed unexpectedly.');
    }
  } finally {
    activeDeployments.delete(deploymentId);
    await workspace?.cleanup();
  }
}

interface HealthCheckOutcome {
  ok: boolean;
  statusCode?: number;
  reason?: string;
}

async function runHealthCheck(
  liveUrl: string | undefined,
  config: { path: string; expectedStatus: number; timeoutSeconds: number; retries: number }
): Promise<HealthCheckOutcome> {
  if (!liveUrl) {
    return { ok: false, reason: 'The provider did not return a live URL to health-check.' };
  }

  const url = new URL(config.path, liveUrl).toString();
  let lastReason = 'Health check did not run.';

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000);
      const response = await fetch(url, { signal: controller.signal, redirect: 'follow' }).finally(() => clearTimeout(timeout));

      if (response.status === config.expectedStatus) {
        return { ok: true, statusCode: response.status };
      }
      lastReason = `Expected HTTP ${config.expectedStatus} from ${config.path}, got ${response.status}.`;
    } catch (err) {
      lastReason = `Could not reach ${config.path}: ${err instanceof Error ? err.message : 'network error'}.`;
    }

    if (attempt < config.retries) {
      await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_RETRY_DELAY_MS));
    }
  }

  return { ok: false, reason: lastReason };
}

function startInBackground(deploymentId: string, owner: Types.ObjectId, projectId: string): void {
  void runDeploymentPipeline(deploymentId, owner, projectId).catch((err) => {
    logger.error('deployment.service.background_run_failed', {
      deploymentId,
      error: err instanceof Error ? err.message : err,
    });
  });
}

export interface DeploymentReadinessCheck {
  label: string;
  passed: boolean;
  detail?: string;
  /** Whether this check actually blocks `createDeployment` — distinct from just being informational
   *  (e.g. a dirty git tree is shown but doesn't block since `allowDirty` is a valid, explicit
   *  override; it's still reported so the user can see it, per spec §37's "factual checks, not a
   *  hidden score" rule). */
  blocking: boolean;
}

/** Pre-deployment validation (spec §15/§37) — every check here is something the user can act on
 *  directly; deliberately no numeric score, just facts. Read-only: never creates a `Deployment` or
 *  runs the sandbox. */
export async function validateDeployment(
  owner: Types.ObjectId,
  projectId: string,
  environment: CreateDeploymentInput['environment'],
  branchOverride?: string
): Promise<{ ready: boolean; checks: DeploymentReadinessCheck[] }> {
  const project = await getProjectById(owner, projectId);
  const config = await DeploymentConfigModel.findOne({ project: project._id, environment });

  const checks: DeploymentReadinessCheck[] = [
    {
      label: 'Build configured',
      passed: Boolean(config?.buildCommand),
      detail: config?.buildCommand,
      blocking: true,
    },
    {
      label: 'Deployment provider connected',
      passed: Boolean(config && getProvider(config.provider).isConfigured()),
      detail: config?.provider,
      blocking: true,
    },
    {
      label: 'GitHub repository connected',
      passed: Boolean(project.github?.connected),
      detail: project.github?.repositoryFullName,
      blocking: true,
    },
    {
      label: 'Health check configured',
      passed: Boolean(config?.healthCheck?.path),
      detail: config?.healthCheck?.path,
      blocking: false,
    },
    {
      label: 'Tests configured',
      passed: Boolean(config?.testCommand),
      detail: config?.testCommand,
      blocking: false,
    },
  ];

  if (project.github?.connected) {
    try {
      const drift = await checkDrift(owner, projectId, branchOverride || config?.branch);
      checks.push({
        label: 'Git status clean',
        passed: drift.clean,
        detail: drift.clean
          ? `Up to date with "${drift.branch}"`
          : `${drift.totalDifferingCount} file(s) differ from "${drift.branch}" — deploying anyway requires an explicit override`,
        blocking: false,
      });
    } catch (err) {
      checks.push({
        label: 'Git status clean',
        passed: false,
        detail: err instanceof Error ? err.message : 'Could not check git status',
        blocking: false,
      });
    }
  }

  return { ready: checks.filter((check) => check.blocking).every((check) => check.passed), checks };
}

export async function createDeployment(owner: Types.ObjectId, projectId: string, input: CreateDeploymentInput): Promise<DeploymentDocument> {
  const project = await getProjectById(owner, projectId);

  const existing = await DeploymentModel.findOne({
    project: project._id,
    environment: input.environment,
    status: { $in: NON_TERMINAL_STATUSES },
  });
  if (existing) {
    throw ApiError.conflict(`A deployment to ${input.environment} is already in progress.`);
  }

  const config = await DeploymentConfigModel.findOne({ project: project._id, environment: input.environment });
  if (!config) {
    throw ApiError.badRequest(`Configure deployment settings for ${input.environment} before deploying.`);
  }

  const provider = getProvider(config.provider);
  if (!provider.isConfigured()) {
    throw ApiError.badRequest(`The ${config.provider} provider is not configured yet.`);
  }

  const drift = await checkDrift(owner, projectId, input.branch || config.branch);
  if (!drift.clean && !input.allowDirty) {
    throw ApiError.badRequest(
      `${drift.totalDifferingCount} file(s) differ from "${drift.branch}" on GitHub. Commit and push your changes first, or confirm you want to deploy anyway.`,
      { files: drift.differingPaths }
    );
  }

  const deployment = await DeploymentModel.create({
    project: project._id,
    owner,
    provider: config.provider,
    environment: input.environment,
    status: DeploymentStatus.QUEUED,
    triggeredBy: DeploymentTrigger.MANUAL,
    branch: drift.branch,
    commitHash: drift.headCommitSha,
    buildLogs: '',
    deploymentLogs: '',
  });

  await logActivity(owner, ActivityType.DEPLOYMENT_TRIGGERED, `Started a ${input.environment} deployment`, {
    projectId,
    deploymentId: deployment.id as string,
  });

  startInBackground(deployment.id as string, owner, projectId);

  return deployment;
}

export async function cancelDeployment(owner: Types.ObjectId, projectId: string, deploymentId: string): Promise<DeploymentDocument> {
  const deployment = await getDeploymentOrThrow(owner, projectId, deploymentId);

  const controller = activeDeployments.get(deploymentId);
  if (!controller) {
    throw ApiError.badRequest('This deployment is not currently running.');
  }
  controller.abort();

  return deployment;
}

/**
 * Rollback (spec §23) — always a brand-new `Deployment` document pointing at the source deployment's
 * exact commit via `rollbackFrom`; history is never mutated or deleted. `runDeploymentPipeline` skips
 * the local install/test/build stages entirely for a rollback (see `isRollback` there) since the
 * point is to redeploy exactly what was previously live, not to rebuild current (possibly different)
 * workspace content and hope it matches.
 */
export async function rollbackDeployment(owner: Types.ObjectId, projectId: string, deploymentId: string): Promise<DeploymentDocument> {
  const source = await getDeploymentOrThrow(owner, projectId, deploymentId);

  if (source.status !== DeploymentStatus.SUCCESS) {
    throw ApiError.badRequest('Only a successful deployment can be rolled back to.');
  }
  if (!source.commitHash) {
    throw ApiError.badRequest('This deployment has no recorded commit to roll back to.');
  }

  const project = await getProjectById(owner, projectId);

  const existing = await DeploymentModel.findOne({
    project: project._id,
    environment: source.environment,
    status: { $in: NON_TERMINAL_STATUSES },
  });
  if (existing) {
    throw ApiError.conflict(`A deployment to ${source.environment} is already in progress.`);
  }

  const config = await DeploymentConfigModel.findOne({ project: project._id, environment: source.environment });
  if (!config) {
    throw ApiError.badRequest(`Configure deployment settings for ${source.environment} before rolling back.`);
  }
  const provider = getProvider(config.provider);
  if (!provider.isConfigured()) {
    throw ApiError.badRequest(`The ${config.provider} provider is not configured yet.`);
  }

  const rollback = await DeploymentModel.create({
    project: project._id,
    owner,
    provider: config.provider,
    environment: source.environment,
    status: DeploymentStatus.QUEUED,
    triggeredBy: DeploymentTrigger.ROLLBACK,
    branch: source.branch,
    commitHash: source.commitHash,
    rollbackFrom: source._id,
    buildLogs: '',
    deploymentLogs: '',
  });

  await logActivity(
    owner,
    ActivityType.DEPLOYMENT_ROLLED_BACK,
    `Rolling back ${source.environment} to commit ${source.commitHash.slice(0, 7)}`,
    { projectId, deploymentId: rollback.id as string, rollbackFrom: deploymentId }
  );

  startInBackground(rollback.id as string, owner, projectId);

  return rollback;
}

export interface WebhookDeploymentParams {
  environment: DeploymentEnvironment;
  branch: string;
  commitSha: string;
  pullRequestNumber?: number;
}

/**
 * Auto-deploy from a verified GitHub webhook (spec §18/§19/§20) — called by
 * `githubWebhook.service.ts` once the signature is verified and the event is decoded, never
 * reachable from an unauthenticated request directly. Silently no-ops (returns `null`, logged, not
 * thrown) whenever auto-deploy isn't actually configured for this branch/environment, rather than
 * erroring back to GitHub's webhook delivery system for what is often just "no config yet."
 */
export async function createWebhookDeployment(
  owner: Types.ObjectId,
  projectId: string,
  params: WebhookDeploymentParams
): Promise<DeploymentDocument | null> {
  const project = await getProjectById(owner, projectId);

  const config = await DeploymentConfigModel.findOne({ project: project._id, environment: params.environment });
  if (!config || !config.autoDeploy || config.branch !== params.branch) {
    return null;
  }

  const provider = getProvider(config.provider);
  if (!provider.isConfigured()) {
    logger.warn('deployment.service.webhook_provider_not_configured', { projectId, provider: config.provider });
    return null;
  }

  const concurrencyFilter: FilterQuery<DeploymentDocument> = {
    project: project._id,
    environment: params.environment,
    status: { $in: NON_TERMINAL_STATUSES },
  };
  concurrencyFilter.pullRequestNumber = params.pullRequestNumber ?? { $exists: false };

  const existing = await DeploymentModel.findOne(concurrencyFilter);
  if (existing) {
    logger.info('deployment.service.webhook_skip_concurrent', { projectId, environment: params.environment });
    return null;
  }

  const deployment = await DeploymentModel.create({
    project: project._id,
    owner,
    provider: config.provider,
    environment: params.environment,
    status: DeploymentStatus.QUEUED,
    triggeredBy: DeploymentTrigger.WEBHOOK,
    branch: params.branch,
    commitHash: params.commitSha,
    pullRequestNumber: params.pullRequestNumber,
    buildLogs: '',
    deploymentLogs: '',
  });

  await logActivity(
    owner,
    ActivityType.DEPLOYMENT_TRIGGERED,
    params.pullRequestNumber
      ? `GitHub PR #${params.pullRequestNumber} triggered a preview deployment`
      : `A GitHub push triggered a ${params.environment} deployment`,
    { projectId, deploymentId: deployment.id as string }
  );

  startInBackground(deployment.id as string, owner, projectId);

  return deployment;
}
