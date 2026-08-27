import { Types } from 'mongoose';
import { IPlanTask, ProjectPlanStatus, WorkflowMode, WorkflowStatus, WorkflowTaskStatus } from 'shared';
import { orchestratorConfig } from '../config/orchestrator.config';
import { WorkflowDocument, WorkflowModel } from '../models';
import * as plannerService from '../agents/planner/planner.service';
import { getProjectById } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { getAgentIdForTask, isOrchestrable } from './agent-registry';
import { buildGraph, detectCycle } from './orchestrator.graph';
import { isWorkflowActive, requestCancel, requestPause, requestResumeFlag, runWorkflow } from './orchestrator';

export interface CreateWorkflowParams {
  owner: Types.ObjectId;
  projectId: string;
  prompt?: string;
  conversationId?: string;
  planId?: string;
  mode: WorkflowMode;
  signal: AbortSignal;
}

/** Kicks off a background run without blocking the caller — errors are logged, never thrown into an
 *  unhandled rejection, mirroring how every other "fire and forget" spot in this codebase (e.g.
 *  `workspace.service.ts`'s `touchWorkspace`) handles best-effort async work. */
function startInBackground(workflowId: string, owner: Types.ObjectId, projectId: string): void {
  void runWorkflow(workflowId, owner, projectId).catch((err) => {
    logger.error('orchestrator.workflow.background_run_failed', {
      workflowId,
      error: err instanceof Error ? err.message : err,
    });
  });
}

/**
 * Creates and starts a workflow (Phase 10 spec §10) — exactly one of `prompt` (generate + auto-approve
 * a new plan first, mirroring `autopilot.service.ts`'s existing behavior) or `planId` (run against an
 * already-approved plan) must be given. Plan generation/approval, if needed, still happens
 * synchronously within this call (so the returned workflow always has a real, valid plan) — only the
 * *task execution* phase after that runs detached.
 */
export async function createWorkflow(params: CreateWorkflowParams): Promise<WorkflowDocument> {
  const { owner, projectId, prompt, conversationId, planId, mode, signal } = params;
  const project = await getProjectById(owner, projectId);

  let plan;
  if (planId) {
    plan = await plannerService.getPlan(owner, projectId, planId);
    if (plan.status !== ProjectPlanStatus.APPROVED) {
      throw ApiError.badRequest(
        `Cannot run a workflow against a plan with status "${plan.status}" — approve it first.`
      );
    }
  } else if (prompt) {
    const generated = await plannerService.generatePlan(owner, projectId, prompt, conversationId, signal);
    plan = await plannerService.updatePlanStatus(owner, projectId, generated.id, 'approved');
  } else {
    throw ApiError.badRequest('Provide either a prompt or a planId.');
  }

  const tasks = (plan.tasks ?? []) as IPlanTask[];
  if (tasks.length === 0) {
    throw ApiError.badRequest('This plan has no tasks to run.');
  }

  const graph = buildGraph(tasks);
  const cycle = detectCycle(graph);
  if (cycle) {
    throw ApiError.badRequest('This plan has a circular task dependency and cannot be run.', {
      cycle: [cycle.join(' → ')],
    });
  }

  const taskStates = tasks.map((task) => ({
    taskId: task.id,
    agentId: getAgentIdForTask(task),
    status: isOrchestrable(task) ? WorkflowTaskStatus.PENDING : WorkflowTaskStatus.SKIPPED,
    attempts: 0,
    generationIds: [] as string[],
  }));

  const workflow = await WorkflowModel.create({
    project: project._id,
    plan: plan._id,
    owner,
    status: WorkflowStatus.QUEUED,
    mode,
    maxConcurrency: orchestratorConfig.MAX_CONCURRENT_AGENTS,
    fixCycles: 0,
    tasks: taskStates,
    events: [],
  });

  logger.info('orchestrator.workflow.created', { workflowId: workflow.id, projectId: project.id, planId: plan.id });

  startInBackground(workflow.id, owner, projectId);

  return workflow;
}

async function getWorkflowOrThrow(owner: Types.ObjectId, projectId: string, workflowId: string): Promise<WorkflowDocument> {
  if (!Types.ObjectId.isValid(workflowId)) {
    throw ApiError.badRequest('Invalid workflow id');
  }

  const project = await getProjectById(owner, projectId);
  const workflow = await WorkflowModel.findOne({ _id: workflowId, project: project._id });

  if (!workflow) {
    throw ApiError.notFound('Workflow not found');
  }

  return workflow;
}

export async function getWorkflow(owner: Types.ObjectId, projectId: string, workflowId: string): Promise<WorkflowDocument> {
  return getWorkflowOrThrow(owner, projectId, workflowId);
}

export async function listWorkflows(owner: Types.ObjectId, projectId: string): Promise<WorkflowDocument[]> {
  const project = await getProjectById(owner, projectId);
  return WorkflowModel.find({ project: project._id }).sort({ createdAt: -1 }).limit(50);
}

export async function pauseWorkflow(owner: Types.ObjectId, projectId: string, workflowId: string): Promise<WorkflowDocument> {
  const workflow = await getWorkflowOrThrow(owner, projectId, workflowId);

  if (!requestPause(workflowId)) {
    throw ApiError.badRequest('This workflow is not currently running.');
  }

  return workflow;
}

/** Resumes a workflow (spec §33/§54) — if it's still alive in-memory (paused mid-loop), just lifts
 *  the pause flag; otherwise (it exited into `waiting_for_approval`, failed, or the server restarted)
 *  starts a fresh detached run, which always reconciles state from `TaskExecutionModel` before
 *  continuing rather than trusting in-memory continuity. */
export async function resumeWorkflow(owner: Types.ObjectId, projectId: string, workflowId: string): Promise<WorkflowDocument> {
  const workflow = await getWorkflowOrThrow(owner, projectId, workflowId);

  const terminalStatuses: string[] = [WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED];
  if (terminalStatuses.includes(workflow.status)) {
    throw ApiError.badRequest(`Cannot resume a workflow with status "${workflow.status}".`);
  }

  if (isWorkflowActive(workflowId)) {
    requestResumeFlag(workflowId);
    return workflow;
  }

  workflow.status = WorkflowStatus.RUNNING;
  await workflow.save();
  startInBackground(workflowId, owner, projectId);

  return workflow;
}

export async function cancelWorkflow(owner: Types.ObjectId, projectId: string, workflowId: string): Promise<WorkflowDocument> {
  const workflow = await getWorkflowOrThrow(owner, projectId, workflowId);

  if (!requestCancel(workflowId)) {
    // Not actively running (e.g. already finished, or waiting_for_approval after a restart) — mark
    // it cancelled directly rather than silently no-op-ing.
    workflow.status = WorkflowStatus.CANCELLED;
    workflow.completedAt = new Date();
    await workflow.save();
  }

  return workflow;
}

/** Manually retries one failed task (spec §17) — resets it back to `ready` so the next run picks it
 *  up, then (re)starts the run if it isn't already active. */
export async function retryTask(
  owner: Types.ObjectId,
  projectId: string,
  workflowId: string,
  taskId: string
): Promise<WorkflowDocument> {
  const workflow = await getWorkflowOrThrow(owner, projectId, workflowId);
  const taskState = workflow.tasks.find((task) => task.taskId === taskId);

  if (!taskState) {
    throw ApiError.notFound(`Task "${taskId}" is not part of this workflow`);
  }
  if (taskState.status !== WorkflowTaskStatus.FAILED) {
    throw ApiError.badRequest(`Only a failed task can be retried (current status: "${taskState.status}")`);
  }

  taskState.status = WorkflowTaskStatus.READY;
  taskState.error = undefined;
  taskState.failureCategory = undefined;
  workflow.markModified('tasks');

  if (![WorkflowStatus.RUNNING, WorkflowStatus.PAUSED].includes(workflow.status as never)) {
    workflow.status = WorkflowStatus.RUNNING;
  }
  await workflow.save();

  if (!isWorkflowActive(workflowId)) {
    startInBackground(workflowId, owner, projectId);
  }

  return workflow;
}
