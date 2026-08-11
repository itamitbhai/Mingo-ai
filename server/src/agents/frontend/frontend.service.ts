import { Types } from 'mongoose';
import {
  AgentGenerationStatus,
  IFrontendOperation,
  IPlanTask,
  ITaskBoardItem,
  ProjectPlanStatus,
  RecommendedAgent,
  TaskExecutionStatus,
  TaskType,
} from 'shared';
import { frontendAgentConfig } from '../../config/frontendAgent.config';
import { AgentGenerationDocument, AgentGenerationModel, TaskExecutionDocument, TaskExecutionModel } from '../../models';
import { getProjectById } from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as plannerService from '../planner/planner.service';
import { buildFrontendContext } from './frontend.context';
import { FrontendValidationError, runFrontendAgent } from './frontend.agent';
import { FrontendOperationOutput } from './frontend.schema';
import { OnFrontendStage } from './frontend.types';
import { applyFrontendOperations, previewFrontendOperations } from './frontend.operations';

export function isFrontendTask(task: IPlanTask): boolean {
  return task.type === TaskType.FRONTEND || task.recommendedAgent === RecommendedAgent.FRONTEND;
}

function owningAgentLabel(task: IPlanTask): string {
  const agent = task.recommendedAgent ?? task.type;
  const label = agent.charAt(0).toUpperCase() + agent.slice(1);
  return `${label} Agent`;
}

export function describeOwningAgent(task: IPlanTask): string {
  return `This task belongs to the ${owningAgentLabel(task)}, not the Frontend Agent.`;
}

function findTask(tasks: IPlanTask[], taskId: string): IPlanTask {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw ApiError.notFound(`Task "${taskId}" was not found in this plan`);
  }
  return task;
}

function toStoredOperation(op: FrontendOperationOutput): IFrontendOperation {
  const base = { type: op.type, path: op.path, reason: op.reason };
  switch (op.type) {
    case 'create':
    case 'update':
      return { ...base, content: op.content };
    case 'rename':
      return { ...base, newName: op.newName };
    case 'move':
      return { ...base, destinationPath: op.destinationPath };
    default:
      return base;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Atomically claims the task run-lock (spec §29): a `RUNNING` doc means a generation call is
 *  currently in flight for this task, and colliding with the unique `{plan, taskId}` index on
 *  upsert is how a second concurrent attempt is detected and rejected. Released back to a resting
 *  status (`READY` on success, `FAILED` on error) as soon as the AI call finishes — `RUNNING` only
 *  ever spans the duration of a single execute/regenerate call, never the "awaiting review" period
 *  that follows (that's tracked on the `AgentGeneration` itself via `PREVIEW_READY`).
 */
async function acquireTaskLock(
  project: Types.ObjectId,
  plan: Types.ObjectId,
  taskId: string
): Promise<TaskExecutionDocument> {
  try {
    return await TaskExecutionModel.findOneAndUpdate(
      { plan, taskId, status: { $ne: TaskExecutionStatus.RUNNING } },
      { $set: { project, plan, taskId, status: TaskExecutionStatus.RUNNING, startedAt: new Date(), error: undefined } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw ApiError.conflict('Task already running.');
    }
    throw err;
  }
}

async function finishTask(
  plan: Types.ObjectId,
  taskId: string,
  update: Partial<Pick<TaskExecutionDocument, 'status' | 'error' | 'completedAt' | 'latestGenerationId'>>
) {
  await TaskExecutionModel.findOneAndUpdate({ plan, taskId }, { $set: update });
}

interface DependencyCheck {
  blocked: boolean;
  unmet: string[];
}

async function checkDependencies(plan: Types.ObjectId, task: IPlanTask): Promise<DependencyCheck> {
  if (task.dependencies.length === 0) return { blocked: false, unmet: [] };

  const executions = await TaskExecutionModel.find({ plan, taskId: { $in: task.dependencies } });
  const statusById = new Map(executions.map((execution) => [execution.taskId, execution.status]));
  const unmet = task.dependencies.filter(
    (dependencyId) => statusById.get(dependencyId) !== TaskExecutionStatus.COMPLETED
  );

  return { blocked: unmet.length > 0, unmet };
}

async function getNextGenerationVersion(plan: Types.ObjectId, taskId: string): Promise<number> {
  const latest = await AgentGenerationModel.findOne({ plan, taskId }).sort({ version: -1 }).select('version');
  return (latest?.version ?? 0) + 1;
}

interface RunGenerationParams {
  owner: Types.ObjectId;
  projectId: string;
  planId: string;
  taskId: string;
  feedback?: string;
  signal: AbortSignal;
  onStage?: OnFrontendStage;
}

/** Shared by `executeTask` and `regenerateTask` — the only difference between a first run and a
 *  regeneration is whether `feedback` is present; everything else (auth, plan-approval, task-type
 *  filtering, dependency check, locking, persistence) is identical. */
async function runGenerationForTask({
  owner,
  projectId,
  planId,
  taskId,
  feedback,
  signal,
  onStage,
}: RunGenerationParams): Promise<AgentGenerationDocument> {
  const project = await getProjectById(owner, projectId);
  const plan = await plannerService.getPlan(owner, projectId, planId);

  if (plan.status !== ProjectPlanStatus.APPROVED) {
    throw ApiError.badRequest(`Cannot run the Frontend Agent on a plan with status "${plan.status}" — approve the plan first.`);
  }

  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const task = findTask(tasks, taskId);

  if (!isFrontendTask(task)) {
    throw ApiError.badRequest(describeOwningAgent(task));
  }

  const dependencyCheck = await checkDependencies(plan._id, task);
  if (dependencyCheck.blocked) {
    await TaskExecutionModel.findOneAndUpdate(
      { plan: plan._id, taskId },
      { $set: { project: project._id, plan: plan._id, taskId, status: TaskExecutionStatus.BLOCKED } },
      { upsert: true }
    );
    throw ApiError.badRequest('Waiting for required tasks.', { dependencies: dependencyCheck.unmet });
  }

  await acquireTaskLock(project._id, plan._id, taskId);

  logger.info('frontend_agent.started', { projectId: project.id, planId: plan.id, taskId });
  onStage?.({ stage: 'loading_context', label: 'Reading project context…' });

  try {
    const context = await buildFrontendContext(owner, projectId, task, tasks, feedback);

    onStage?.({ stage: 'reading_files', label: 'Inspecting existing components…' });

    const { output, usage } = await runFrontendAgent({ context, signal, onStage });

    onStage?.({ stage: 'planning', label: 'Preparing change preview…' });

    const operations = output.operations.map(toStoredOperation);
    const { preview, operationsWithDiff } = await previewFrontendOperations(owner, projectId, operations);

    if (!preview.valid) {
      throw ApiError.badRequest('The generated changes conflict with the current workspace state.', {
        errors: [...preview.errors, ...preview.conflicts],
      });
    }

    const version = await getNextGenerationVersion(plan._id, taskId);
    const generation = await AgentGenerationModel.create({
      project: project._id,
      plan: plan._id,
      taskId,
      agentType: 'frontend',
      version,
      status: AgentGenerationStatus.PREVIEW_READY,
      operations: operationsWithDiff,
      dependencyRequests: output.dependencyRequests,
      notes: output.notes,
      feedback,
    });

    await finishTask(plan._id, taskId, {
      status: TaskExecutionStatus.READY,
      latestGenerationId: generation._id,
    });

    await usageService.recordUsage({
      userId: owner,
      projectId: project._id,
      modelName: frontendAgentConfig.MODEL,
      purpose: 'frontend_agent',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });

    logger.info('frontend_agent.completed', { projectId: project.id, planId: plan.id, taskId, generationId: generation.id });
    onStage?.({ stage: 'preview_ready', label: 'Changes ready for review.' });

    return generation;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'The Frontend Agent could not generate valid changes.';
    await finishTask(plan._id, taskId, { status: TaskExecutionStatus.FAILED, error: message.slice(0, 500) });

    if (err instanceof FrontendValidationError) {
      await usageService.recordUsage({
        userId: owner,
        projectId: project._id,
        modelName: frontendAgentConfig.MODEL,
        purpose: 'frontend_agent',
        inputTokens: err.usage.inputTokens,
        outputTokens: err.usage.outputTokens,
        totalTokens: err.usage.totalTokens,
      });
      logger.error('frontend_agent.failed', { projectId: project.id, planId: plan.id, taskId, issues: err.issues });
    } else {
      logger.error('frontend_agent.failed', { projectId: project.id, planId: plan.id, taskId, error: err });
    }

    throw err;
  }
}

export async function executeTask(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  taskId: string,
  signal: AbortSignal,
  onStage?: OnFrontendStage
): Promise<AgentGenerationDocument> {
  return runGenerationForTask({ owner, projectId, planId, taskId, signal, onStage });
}

export async function regenerateTask(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  taskId: string,
  feedback: string | undefined,
  signal: AbortSignal,
  onStage?: OnFrontendStage
): Promise<AgentGenerationDocument> {
  return runGenerationForTask({ owner, projectId, planId, taskId, feedback, signal, onStage });
}

async function getGenerationOrThrow(
  owner: Types.ObjectId,
  projectId: string,
  generationId: string
): Promise<{ generation: AgentGenerationDocument; project: Awaited<ReturnType<typeof getProjectById>> }> {
  if (!Types.ObjectId.isValid(generationId)) {
    throw ApiError.badRequest('Invalid generation id');
  }

  const project = await getProjectById(owner, projectId);
  const generation = await AgentGenerationModel.findOne({ _id: generationId, project: project._id });

  if (!generation) {
    throw ApiError.notFound('Generation not found');
  }

  return { generation, project };
}

/**
 * Applies a previously previewed generation (spec §46/§25/§26): re-validates the stored operations
 * against *current* workspace state (files may have changed since the preview was created), then
 * applies them atomically through `frontend.operations.applyFrontendOperations` — snapshot first,
 * batch apply, restore-on-failure. `AI_AUTO_APPLY` is never consulted here; apply is always an
 * explicit, separate call.
 */
export async function applyGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation, project } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot apply a generation with status "${generation.status}"`);
  }

  const operations = generation.operations;
  const { preview } = await previewFrontendOperations(owner, projectId, operations);

  if (!preview.valid) {
    throw ApiError.badRequest('These changes are no longer valid against the current workspace — try regenerating.', {
      errors: [...preview.errors, ...preview.conflicts],
    });
  }

  generation.status = AgentGenerationStatus.APPLYING;
  await generation.save();

  try {
    const result = await applyFrontendOperations(owner, projectId, generation.taskId, operations);

    generation.status = AgentGenerationStatus.COMPLETED;
    await generation.save();

    await finishTask(generation.plan, generation.taskId, {
      status: TaskExecutionStatus.COMPLETED,
      completedAt: new Date(),
      latestGenerationId: generation._id,
    });

    logger.info('frontend_agent.applied', { projectId: project.id, taskId: generation.taskId, generationId: generation.id });

    return result;
  } catch (err) {
    generation.status = AgentGenerationStatus.FAILED;
    await generation.save();
    throw err;
  }
}

/** Rejects a proposed generation — no filesystem writes ever happen here (spec §47). */
export async function rejectGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot reject a generation with status "${generation.status}"`);
  }

  generation.status = AgentGenerationStatus.CANCELLED;
  await generation.save();

  await finishTask(generation.plan, generation.taskId, { status: TaskExecutionStatus.CANCELLED });

  logger.info('frontend_agent.rejected', { projectId, taskId: generation.taskId, generationId: generation.id });

  return generation;
}

export async function listGenerations(owner: Types.ObjectId, projectId: string, taskId: string, planId: string) {
  const project = await getProjectById(owner, projectId);
  const plan = await plannerService.getPlan(owner, projectId, planId);

  return AgentGenerationModel.find({ project: project._id, plan: plan._id, taskId }).sort({ version: -1 });
}

export async function getGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation } = await getGenerationOrThrow(owner, projectId, generationId);
  return generation;
}

/** Merges `plan.tasks` with live `TaskExecution` rows for the task board (spec §54). A task with no
 *  execution record yet is computed as `READY` (dependencies satisfied) or `BLOCKED` (they aren't)
 *  — never persisted speculatively, only ever written once a real run is attempted. */
export async function listTasksWithStatus(
  owner: Types.ObjectId,
  projectId: string,
  planId: string
): Promise<ITaskBoardItem[]> {
  const plan = await plannerService.getPlan(owner, projectId, planId);
  const tasks = (plan.tasks ?? []) as IPlanTask[];

  const executions = await TaskExecutionModel.find({ plan: plan._id });
  const executionByTaskId = new Map(executions.map((execution) => [execution.taskId, execution]));
  const completedIds = new Set(
    executions.filter((execution) => execution.status === TaskExecutionStatus.COMPLETED).map((e) => e.taskId)
  );

  return tasks.map((task) => {
    const frontend = isFrontendTask(task);
    const owningAgent = frontend ? undefined : owningAgentLabel(task);

    const execution = executionByTaskId.get(task.id);
    if (execution) {
      return {
        ...task,
        executionStatus: execution.status,
        latestGenerationId: execution.latestGenerationId?.toString(),
        error: execution.error,
        isFrontendTask: frontend,
        owningAgent,
      };
    }

    const isReady = task.dependencies.every((dependencyId) => completedIds.has(dependencyId));
    return {
      ...task,
      executionStatus: isReady ? TaskExecutionStatus.READY : TaskExecutionStatus.BLOCKED,
      isFrontendTask: frontend,
      owningAgent,
    };
  });
}
