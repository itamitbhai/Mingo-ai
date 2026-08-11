import { Types } from 'mongoose';
import {
  AgentGenerationStatus,
  IApiContract,
  IBackendOperation,
  IPlanApiEndpoint,
  IPlanTask,
  ProjectPlanStatus,
  RecommendedAgent,
  TaskExecutionStatus,
  TaskType,
} from 'shared';
import { backendAgentConfig } from '../../config/backendAgent.config';
import { AgentGenerationDocument, AgentGenerationModel, TaskExecutionDocument, TaskExecutionModel } from '../../models';
import { getProjectById } from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as plannerService from '../planner/planner.service';
import { buildBackendContext } from './backend.context';
import { BackendValidationError, runBackendAgent } from './backend.agent';
import { BackendOperationOutput } from './backend.schema';
import { OnBackendStage } from './backend.types';
import { applyBackendOperations, previewBackendOperations } from './backend.operations';

/** A task belongs to the Backend Agent (spec §39) when the Planner typed it as backend work or
 *  explicitly recommended the Backend Agent — mirrors `frontend.service.ts`'s `isFrontendTask`. */
export function isBackendTask(task: IPlanTask): boolean {
  return task.type === TaskType.BACKEND || task.recommendedAgent === RecommendedAgent.BACKEND;
}

function owningAgentLabel(task: IPlanTask): string {
  const agent = task.recommendedAgent ?? task.type;
  const label = agent.charAt(0).toUpperCase() + agent.slice(1);
  return `${label} Agent`;
}

export function describeOwningAgent(task: IPlanTask): string {
  return `This task belongs to the ${owningAgentLabel(task)}, not the Backend Agent.`;
}

function findTask(tasks: IPlanTask[], taskId: string): IPlanTask {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw ApiError.notFound(`Task "${taskId}" was not found in this plan`);
  }
  return task;
}

function toStoredOperation(op: BackendOperationOutput): IBackendOperation {
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

/** Flags a generated `apiContracts` entry that doesn't match any endpoint in the Planner's approved
 *  `ProjectPlan.api` (spec §24/§25/§56) — reported to the user as a warning, never used to reject
 *  the generation outright, since a plan may legitimately omit low-level implementation detail. */
function computeContractWarnings(approved: IPlanApiEndpoint[], generated: IApiContract[]): string[] {
  if (approved.length === 0) return [];

  const approvedKeys = new Set(
    approved.map((endpoint) => `${endpoint.method.toUpperCase()} ${endpoint.path}`)
  );

  return generated
    .filter((contract) => !approvedKeys.has(`${contract.method.toUpperCase()} ${contract.path}`))
    .map(
      (contract) =>
        `API contract conflict: ${contract.method.toUpperCase()} ${contract.path} was generated but is not in the approved plan's API surface.`
    );
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Atomically claims the task run-lock — identical mechanism to `frontend.service.ts`'s
 *  `acquireTaskLock`: a `RUNNING` doc means a generation call is already in flight for this task,
 *  and colliding with the unique `{plan, taskId}` index on upsert is how a second concurrent
 *  attempt is detected and rejected. The same `TaskExecutionModel` is shared across agents (keyed
 *  only by `{plan, taskId}`), so a backend task and a frontend task never contend for each other's
 *  lock, but two backend attempts on the same task do. */
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
  onStage?: OnBackendStage;
}

/** Shared by `executeTask` and `regenerateTask` — mirrors `frontend.service.ts`'s
 *  `runGenerationForTask`: the only difference between a first run and a regeneration is whether
 *  `feedback` is present; everything else (auth, plan-approval, task-type filtering, dependency
 *  check, locking, persistence) is identical. */
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
    throw ApiError.badRequest(`Cannot run the Backend Agent on a plan with status "${plan.status}" — approve the plan first.`);
  }

  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const task = findTask(tasks, taskId);

  if (!isBackendTask(task)) {
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

  logger.info('backend_agent.started', { projectId: project.id, planId: plan.id, taskId });
  onStage?.({ stage: 'loading_context', label: 'Reading backend structure…' });

  try {
    const apiEndpoints = (plan.api ?? []) as IPlanApiEndpoint[];
    const context = await buildBackendContext(owner, projectId, task, tasks, apiEndpoints, feedback);

    onStage?.({ stage: 'reading_files', label: 'Inspecting existing routes, controllers, and middleware…' });

    const { output, usage } = await runBackendAgent({ context, signal, onStage });

    onStage?.({ stage: 'planning', label: 'Preparing change preview…' });

    const operations = output.operations.map(toStoredOperation);
    const { preview, operationsWithDiff } = await previewBackendOperations(owner, projectId, operations);

    if (!preview.valid) {
      throw ApiError.badRequest('The generated changes conflict with the current workspace state.', {
        errors: [...preview.errors, ...preview.conflicts],
      });
    }

    const contractWarnings = computeContractWarnings(apiEndpoints, output.apiContracts);
    if (contractWarnings.length > 0) {
      logger.warn('backend_agent.contractWarnings', { projectId: project.id, taskId, contractWarnings });
    }

    const version = await getNextGenerationVersion(plan._id, taskId);
    const generation = await AgentGenerationModel.create({
      project: project._id,
      plan: plan._id,
      taskId,
      agentType: 'backend',
      version,
      status: AgentGenerationStatus.PREVIEW_READY,
      operations: operationsWithDiff,
      dependencyRequests: output.dependencyRequests,
      apiContracts: output.apiContracts,
      contractWarnings,
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
      modelName: backendAgentConfig.MODEL,
      purpose: 'backend_agent',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });

    logger.info('backend_agent.completed', { projectId: project.id, planId: plan.id, taskId, generationId: generation.id });
    onStage?.({ stage: 'preview_ready', label: 'Changes ready for review.' });

    return generation;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'The Backend Agent could not generate valid changes.';
    await finishTask(plan._id, taskId, { status: TaskExecutionStatus.FAILED, error: message.slice(0, 500) });

    if (err instanceof BackendValidationError) {
      await usageService.recordUsage({
        userId: owner,
        projectId: project._id,
        modelName: backendAgentConfig.MODEL,
        purpose: 'backend_agent',
        inputTokens: err.usage.inputTokens,
        outputTokens: err.usage.outputTokens,
        totalTokens: err.usage.totalTokens,
      });
      logger.error('backend_agent.failed', { projectId: project.id, planId: plan.id, taskId, issues: err.issues });
    } else {
      logger.error('backend_agent.failed', { projectId: project.id, planId: plan.id, taskId, error: err });
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
  onStage?: OnBackendStage
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
  onStage?: OnBackendStage
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
 * Applies a previously previewed generation — re-validates the stored operations against *current*
 * workspace state (files may have changed since the preview was created), then applies them
 * atomically through `backend.operations.applyBackendOperations`: snapshot first, batch apply,
 * restore-on-failure. Mirrors `frontend.service.ts`'s `applyGeneration`. In practice, the generic
 * `POST /workspace/ai/apply` route (spec §73) also reaches a Backend Agent generation directly
 * through the Frontend Agent's identically-shaped `applyGeneration` — both call through to the same
 * Phase 4 primitives, so either path is safe; this one exists so `backend.service` is a complete,
 * self-contained module like `frontend.service`.
 */
export async function applyGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation, project } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot apply a generation with status "${generation.status}"`);
  }

  const operations = generation.operations;
  const { preview } = await previewBackendOperations(owner, projectId, operations);

  if (!preview.valid) {
    throw ApiError.badRequest('These changes are no longer valid against the current workspace — try regenerating.', {
      errors: [...preview.errors, ...preview.conflicts],
    });
  }

  generation.status = AgentGenerationStatus.APPLYING;
  await generation.save();

  try {
    const result = await applyBackendOperations(owner, projectId, generation.taskId, operations);

    generation.status = AgentGenerationStatus.COMPLETED;
    await generation.save();

    await finishTask(generation.plan, generation.taskId, {
      status: TaskExecutionStatus.COMPLETED,
      completedAt: new Date(),
      latestGenerationId: generation._id,
    });

    logger.info('backend_agent.applied', { projectId: project.id, taskId: generation.taskId, generationId: generation.id });

    return result;
  } catch (err) {
    generation.status = AgentGenerationStatus.FAILED;
    await generation.save();
    throw err;
  }
}

/** Rejects a proposed generation — no filesystem writes ever happen here. Mirrors
 *  `frontend.service.ts`'s `rejectGeneration`. */
export async function rejectGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot reject a generation with status "${generation.status}"`);
  }

  generation.status = AgentGenerationStatus.CANCELLED;
  await generation.save();

  await finishTask(generation.plan, generation.taskId, { status: TaskExecutionStatus.CANCELLED });

  logger.info('backend_agent.rejected', { projectId, taskId: generation.taskId, generationId: generation.id });

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
