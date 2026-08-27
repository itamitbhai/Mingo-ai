import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { WorkflowTaskStatus } from 'shared';
import * as contextService from '../agents/context/project-context.service';
import * as testingAgentService from '../agents/testing/testing.service';
import { WorkflowDocument } from '../models';
import * as materializer from '../services/sandbox/materializer.service';
import { sandboxConfig } from '../sandbox/sandbox.config';
import { runInContainer } from '../sandbox/sandbox.executor';
import { ensureImage } from '../sandbox/sandbox.image';
import { assertDockerAvailable, ensureNodeModulesVolume, getDockerClient } from '../sandbox/sandbox.manager';
import { logger } from '../utils/logger';

export interface WorkflowValidationResult {
  ready: boolean;
  reasons: string[];
}

/**
 * If the project's manifest declares a root `build` script, runs it through the Phase 11 sandbox and
 * requires exit code 0 (spec §39/§41). Intentionally light: this is a pass/fail gate on final
 * completion, not a full auto-fix loop for build failures — that would duplicate significant machinery
 * from the test-failure fix loop for a second failure category and is a deferred enhancement, not
 * built this pass. Silently returns (no reason added) when the project has no `build` script — a
 * project that never declared one hasn't failed to satisfy a requirement it never had.
 */
async function validateBuild(owner: Types.ObjectId, projectId: string, reasons: string[]): Promise<void> {
  const manifest = await contextService.loadManifest(owner, projectId).catch(() => null);
  if (!manifest?.scripts?.build) return;

  let workspace: Awaited<ReturnType<typeof materializer.materializeWorkspace>> | null = null;

  try {
    await assertDockerAvailable();
    const docker = getDockerClient();
    await ensureImage(docker);
    await ensureNodeModulesVolume(projectId);

    workspace = await materializer.materializeWorkspace(owner, projectId);
    const hasLockfile = await stat(path.join(workspace.dir, 'package-lock.json')).then(
      () => true,
      () => false
    );

    await runInContainer(docker, {
      command: 'npm',
      args: hasLockfile
        ? ['ci', '--no-audit', '--no-fund', '--prefer-offline']
        : ['install', '--no-audit', '--no-fund', '--prefer-offline'],
      workspaceDir: workspace.dir,
      projectId,
      networkMode: 'install',
      timeoutMs: sandboxConfig.INSTALL_TIMEOUT_MS,
      sandboxId: `build-check-${projectId}`,
      signal: new AbortController().signal,
    });

    const result = await runInContainer(docker, {
      command: 'npm',
      args: ['run', 'build'],
      workspaceDir: workspace.dir,
      projectId,
      networkMode: 'none',
      timeoutMs: sandboxConfig.TIMEOUT_MS,
      sandboxId: `build-check-${projectId}`,
      signal: new AbortController().signal,
    });

    if (result.exitCode !== 0) {
      const detail = (result.stderr || result.stdout).slice(-300);
      reasons.push(`Build failed (exit code ${result.exitCode}): ${detail}`);
    }
  } catch (err) {
    logger.error('orchestrator.validator.build_check_failed', {
      projectId,
      error: err instanceof Error ? err.message : err,
    });
    reasons.push(`Build validation could not run: ${err instanceof Error ? err.message : 'unknown error'}`);
  } finally {
    await workspace?.cleanup();
  }
}

/**
 * Final validation before a workflow may be marked `completed` (Phase 10 spec §28/§29, Phase 11
 * spec §39/§41): every task reached a terminal, non-blocking state, its most recent real `TestRun`
 * (if any) shows no failures, and — if the project declares one — its build succeeds in the sandbox.
 * Never claims success without checking real, persisted state this workflow itself produced.
 */
export async function validateWorkflowCompletion(
  owner: Types.ObjectId,
  projectId: string,
  workflow: WorkflowDocument
): Promise<WorkflowValidationResult> {
  const reasons: string[] = [];

  const incomplete = workflow.tasks.filter(
    (task) => task.status !== WorkflowTaskStatus.COMPLETED && task.status !== WorkflowTaskStatus.SKIPPED
  );
  if (incomplete.length > 0) {
    reasons.push(`${incomplete.length} task(s) did not reach a completed state`);
  }

  const needsReview = workflow.tasks.filter((task) => task.status === WorkflowTaskStatus.NEEDS_REVIEW);
  if (needsReview.length > 0) {
    reasons.push(`${needsReview.length} task(s) still need review`);
  }

  const testingTasks = workflow.tasks.filter(
    (task) => task.agentId === 'testing' && task.status === WorkflowTaskStatus.COMPLETED
  );

  for (const task of testingTasks) {
    const runs = await testingAgentService
      .listTestRuns(owner, projectId, workflow.plan.toString(), task.taskId)
      .catch(() => []);
    const latest = runs[0];

    if (!latest) {
      reasons.push(`Testing task "${task.taskId}" never actually ran`);
      continue;
    }

    const failedCount = latest.summary?.failed ?? 0;
    const unhealthyStatus = ['failed', 'error', 'timeout', 'cancelled'].includes(latest.status);

    if (unhealthyStatus || failedCount > 0) {
      reasons.push(`Testing task "${task.taskId}" has not passed (status: ${latest.status})`);
    }
  }

  if (reasons.length === 0) {
    await validateBuild(owner, projectId, reasons);
  }

  return { ready: reasons.length === 0, reasons };
}
