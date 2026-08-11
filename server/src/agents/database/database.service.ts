import { Types } from 'mongoose';
import {
  AgentGenerationStatus,
  IApiContract,
  IDatabaseOperation,
  IDatabaseSchemaContract,
  IPlanTask,
  ProjectPlanStatus,
  RecommendedAgent,
  TaskExecutionStatus,
  TaskType,
} from 'shared';
import { databaseAgentConfig } from '../../config/databaseAgent.config';
import { AgentGenerationDocument, AgentGenerationModel, TaskExecutionDocument, TaskExecutionModel } from '../../models';
import { getProjectById } from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as plannerService from '../planner/planner.service';
import { buildDatabaseContext } from './database.context';
import { computeSchemaContractWarnings } from './database.planner';
import { DatabaseValidationError, runDatabaseAgent } from './database.agent';
import { DatabaseOperationOutput } from './database.schema';
import { OnDatabaseStage } from './database.types';
import { applyDatabaseOperations, previewDatabaseOperations } from './database.operations';

/** A task belongs to the Database Agent (spec §11) when the Planner typed it as database work or
 *  explicitly recommended the Database Agent — mirrors `backend.service.ts`'s `isBackendTask`. */
export function isDatabaseTask(task: IPlanTask): boolean {
  return task.type === TaskType.DATABASE || task.recommendedAgent === RecommendedAgent.DATABASE;
}

function owningAgentLabel(task: IPlanTask): string {
  const agent = task.recommendedAgent ?? task.type;
  const label = agent.charAt(0).toUpperCase() + agent.slice(1);
  return `${label} Agent`;
}

export function describeOwningAgent(task: IPlanTask): string {
  return `This task belongs to the ${owningAgentLabel(task)}, not the Database Agent.`;
}

function findTask(tasks: IPlanTask[], taskId: string): IPlanTask {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw ApiError.notFound(`Task "${taskId}" was not found in this plan`);
  }
  return task;
}

function toStoredOperation(op: DatabaseOperationOutput): IDatabaseOperation {
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

/** Gathers the Backend Agent's already-implemented API contracts for this plan (spec §25/§26): the
 *  latest non-stale (`completed` or `preview_ready`) generation per backend task, deduplicated by
 *  `METHOD path` across tasks. Best-effort — an empty result just means no Backend Agent generation
 *  has run yet, which `database.prompts.ts`/`database.planner.ts` both handle gracefully. */
async function loadBackendApiContracts(plan: Types.ObjectId): Promise<IApiContract[]> {
  const generations = await AgentGenerationModel.find({
    plan,
    agentType: 'backend',
    status: { $in: [AgentGenerationStatus.COMPLETED, AgentGenerationStatus.PREVIEW_READY] },
  }).sort({ version: -1 });

  const latestByTask = new Map<string, AgentGenerationDocument>();
  for (const generation of generations) {
    if (!latestByTask.has(generation.taskId)) {
      latestByTask.set(generation.taskId, generation);
    }
  }

  const contractsByKey = new Map<string, IApiContract>();
  for (const generation of latestByTask.values()) {
    for (const contract of generation.apiContracts ?? []) {
      contractsByKey.set(`${contract.method.toUpperCase()} ${contract.path}`, contract);
    }
  }

  return Array.from(contractsByKey.values());
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Atomically claims the task run-lock — identical mechanism to `backend.service.ts`'s
 *  `acquireTaskLock`. */
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
  onStage?: OnDatabaseStage;
}

/** Shared by `executeTask` and `regenerateTask` — mirrors `backend.service.ts`'s
 *  `runGenerationForTask`. */
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
    throw ApiError.badRequest(`Cannot run the Database Agent on a plan with status "${plan.status}" — approve the plan first.`);
  }

  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const task = findTask(tasks, taskId);

  if (!isDatabaseTask(task)) {
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

  logger.info('database_agent.started', { projectId: project.id, planId: plan.id, taskId });
  onStage?.({ stage: 'loading_context', label: 'Reading database structure…' });

  try {
    onStage?.({ stage: 'reading_backend_contract', label: "Reading the Backend Agent's API contract…" });
    const backendApiContracts = await loadBackendApiContracts(plan._id);

    const context = await buildDatabaseContext(
      owner,
      projectId,
      task,
      tasks,
      plan.database ?? null,
      backendApiContracts,
      feedback
    );

    onStage?.({ stage: 'reading_files', label: 'Inspecting existing models and connection setup…' });

    const { output, usage } = await runDatabaseAgent({ context, signal, onStage });

    onStage?.({ stage: 'planning', label: 'Preparing change preview…' });

    const operations = output.operations.map(toStoredOperation);
    const { preview, operationsWithDiff } = await previewDatabaseOperations(owner, projectId, operations);

    if (!preview.valid) {
      throw ApiError.badRequest('The generated changes conflict with the current workspace state.', {
        errors: [...preview.errors, ...preview.conflicts],
      });
    }

    const contractWarnings = computeSchemaContractWarnings(context.requiredFieldPlan, output.schemaContracts);
    if (contractWarnings.length > 0) {
      logger.warn('database_agent.contractWarnings', { projectId: project.id, taskId, contractWarnings });
    }

    const version = await getNextGenerationVersion(plan._id, taskId);
    const generation = await AgentGenerationModel.create({
      project: project._id,
      plan: plan._id,
      taskId,
      agentType: 'database',
      version,
      status: AgentGenerationStatus.PREVIEW_READY,
      operations: operationsWithDiff,
      dependencyRequests: output.dependencyRequests,
      schemaContracts: output.schemaContracts,
      databaseChanges: output.databaseChanges,
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
      modelName: databaseAgentConfig.MODEL,
      purpose: 'database_agent',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });

    logger.info('database_agent.completed', { projectId: project.id, planId: plan.id, taskId, generationId: generation.id });
    onStage?.({ stage: 'preview_ready', label: 'Changes ready for review.' });

    return generation;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'The Database Agent could not generate valid changes.';
    await finishTask(plan._id, taskId, { status: TaskExecutionStatus.FAILED, error: message.slice(0, 500) });

    if (err instanceof DatabaseValidationError) {
      await usageService.recordUsage({
        userId: owner,
        projectId: project._id,
        modelName: databaseAgentConfig.MODEL,
        purpose: 'database_agent',
        inputTokens: err.usage.inputTokens,
        outputTokens: err.usage.outputTokens,
        totalTokens: err.usage.totalTokens,
      });
      logger.error('database_agent.failed', { projectId: project.id, planId: plan.id, taskId, issues: err.issues });
    } else {
      logger.error('database_agent.failed', { projectId: project.id, planId: plan.id, taskId, error: err });
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
  onStage?: OnDatabaseStage
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
  onStage?: OnDatabaseStage
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
 * workspace state, then applies them atomically through
 * `database.operations.applyDatabaseOperations`: snapshot first, batch apply, restore-on-failure.
 * Mirrors `backend.service.ts`'s `applyGeneration`. As with the Backend Agent, the generic
 * `POST /workspace/ai/apply` route also reaches a Database Agent generation directly through the
 * Frontend Agent's identically-shaped `applyGeneration` (spec §75) — both call through to the same
 * Phase 4 primitives, so either path is safe; this one exists so `database.service` is a complete,
 * self-contained module like `frontend.service`/`backend.service`.
 */
export async function applyGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation, project } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot apply a generation with status "${generation.status}"`);
  }

  const operations = generation.operations;
  const { preview } = await previewDatabaseOperations(owner, projectId, operations);

  if (!preview.valid) {
    throw ApiError.badRequest('These changes are no longer valid against the current workspace — try regenerating.', {
      errors: [...preview.errors, ...preview.conflicts],
    });
  }

  generation.status = AgentGenerationStatus.APPLYING;
  await generation.save();

  try {
    const result = await applyDatabaseOperations(owner, projectId, generation.taskId, operations);

    generation.status = AgentGenerationStatus.COMPLETED;
    await generation.save();

    await finishTask(generation.plan, generation.taskId, {
      status: TaskExecutionStatus.COMPLETED,
      completedAt: new Date(),
      latestGenerationId: generation._id,
    });

    logger.info('database_agent.applied', { projectId: project.id, taskId: generation.taskId, generationId: generation.id });

    return result;
  } catch (err) {
    generation.status = AgentGenerationStatus.FAILED;
    await generation.save();
    throw err;
  }
}

/** Rejects a proposed generation — no filesystem writes ever happen here. Mirrors
 *  `backend.service.ts`'s `rejectGeneration`. */
export async function rejectGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot reject a generation with status "${generation.status}"`);
  }

  generation.status = AgentGenerationStatus.CANCELLED;
  await generation.save();

  await finishTask(generation.plan, generation.taskId, { status: TaskExecutionStatus.CANCELLED });

  logger.info('database_agent.rejected', { projectId, taskId: generation.taskId, generationId: generation.id });

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

/**
 * Read-only, workspace-derived database schema metadata for a project (spec §76) — never a live
 * query against a real MongoDB server. Merges every `completed` (applied) Database Agent
 * generation's `schemaContracts` across the whole project, newest generation wins per model.
 */
export async function getProjectDatabaseSchema(
  owner: Types.ObjectId,
  projectId: string
): Promise<IDatabaseSchemaContract[]> {
  const project = await getProjectById(owner, projectId);

  const generations = await AgentGenerationModel.find({
    project: project._id,
    agentType: 'database',
    status: AgentGenerationStatus.COMPLETED,
  }).sort({ createdAt: -1 });

  const byModel = new Map<string, IDatabaseSchemaContract>();
  for (const generation of generations) {
    for (const schema of (generation.schemaContracts ?? []) as IDatabaseSchemaContract[]) {
      if (!byModel.has(schema.model)) {
        byModel.set(schema.model, schema);
      }
    }
  }

  return Array.from(byModel.values());
}
