import { Types } from 'mongoose';
import {
  AgentGenerationStatus,
  IFrontendOperation,
  IPlanTask,
  ITestFailureAnalysis,
  ITestRunScope,
  ProjectPlanStatus,
  RecommendedAgent,
  TaskExecutionStatus,
  TaskType,
  TestRunStatus,
} from 'shared';
import { testingAgentConfig } from '../../config/testingAgent.config';
import {
  AgentGenerationDocument,
  AgentGenerationModel,
  TaskExecutionDocument,
  TaskExecutionModel,
  TestRunDocument,
  TestRunModel,
} from '../../models';
import { getProjectById } from '../../services/project.service';
import * as runRegistry from '../../services/sandbox/run-registry';
import * as usageService from '../../services/usage.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as plannerService from '../planner/planner.service';
import { analyzeFailure } from './testing.analyzer';
import { buildTestingContext } from './testing.context';
import { TestingValidationError, runTestingAgent } from './testing.agent';
import { generateFix } from './testing.fix';
import { applyTestingOperations, previewTestingOperations } from './testing.operations';
import { executeTestRun } from './testing.runner';
import { TestingOperationOutput } from './testing.schema';
import { OnTestingStage, OnTestRunStage } from './testing.types';

/** A task belongs to the Testing Agent when the Planner typed it as testing work or explicitly
 *  recommended the Testing Agent — mirrors `database.service.ts`'s `isDatabaseTask`. */
export function isTestingTask(task: IPlanTask): boolean {
  return task.type === TaskType.TESTING || task.recommendedAgent === RecommendedAgent.TESTING;
}

function owningAgentLabel(task: IPlanTask): string {
  const agent = task.recommendedAgent ?? task.type;
  const label = agent.charAt(0).toUpperCase() + agent.slice(1);
  return `${label} Agent`;
}

export function describeOwningAgent(task: IPlanTask): string {
  return `This task belongs to the ${owningAgentLabel(task)}, not the Testing Agent.`;
}

function findTask(tasks: IPlanTask[], taskId: string): IPlanTask {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw ApiError.notFound(`Task "${taskId}" was not found in this plan`);
  }
  return task;
}

function toStoredOperation(op: TestingOperationOutput): IFrontendOperation {
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

/** Atomically claims the task run-lock — identical mechanism to `database.service.ts`'s
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
  onStage?: OnTestingStage;
}

/** Shared by `executeTask` and `regenerateTask` — mirrors `database.service.ts`'s
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
    throw ApiError.badRequest(`Cannot run the Testing Agent on a plan with status "${plan.status}" — approve the plan first.`);
  }

  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const task = findTask(tasks, taskId);

  if (!isTestingTask(task)) {
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

  logger.info('testing_agent.started', { projectId: project.id, planId: plan.id, taskId });
  onStage?.({ stage: 'loading_context', label: 'Analyzing project…' });

  try {
    onStage?.({ stage: 'reading_contracts', label: 'Reading backend and database contracts…' });
    onStage?.({ stage: 'detecting_framework', label: 'Detecting testing framework…' });

    const context = await buildTestingContext(owner, projectId, task, tasks, plan._id, feedback);

    onStage?.({ stage: 'reading_files', label: 'Inspecting existing tests and source files…' });

    const { output, usage } = await runTestingAgent({ context, signal, onStage });

    onStage?.({ stage: 'planning', label: 'Preparing change preview…' });

    const operations = output.operations.map(toStoredOperation);
    const { preview, operationsWithDiff } = await previewTestingOperations(owner, projectId, operations);

    if (!preview.valid) {
      throw ApiError.badRequest('The generated changes conflict with the current workspace state.', {
        errors: [...preview.errors, ...preview.conflicts],
      });
    }

    if (output.contractWarnings.length > 0) {
      logger.warn('testing_agent.contractWarnings', { projectId: project.id, taskId, contractWarnings: output.contractWarnings });
    }

    const version = await getNextGenerationVersion(plan._id, taskId);
    const generation = await AgentGenerationModel.create({
      project: project._id,
      plan: plan._id,
      taskId,
      agentType: 'testing',
      version,
      status: AgentGenerationStatus.PREVIEW_READY,
      operations: operationsWithDiff,
      dependencyRequests: output.dependencyRequests,
      testPlan: output.testPlan,
      contractWarnings: output.contractWarnings,
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
      modelName: testingAgentConfig.MODEL,
      purpose: 'testing_agent',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });

    logger.info('testing_agent.completed', { projectId: project.id, planId: plan.id, taskId, generationId: generation.id });
    onStage?.({ stage: 'preview_ready', label: 'Tests ready for review.' });

    return generation;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'The Testing Agent could not generate valid tests.';
    await finishTask(plan._id, taskId, { status: TaskExecutionStatus.FAILED, error: message.slice(0, 500) });

    if (err instanceof TestingValidationError) {
      await usageService.recordUsage({
        userId: owner,
        projectId: project._id,
        modelName: testingAgentConfig.MODEL,
        purpose: 'testing_agent',
        inputTokens: err.usage.inputTokens,
        outputTokens: err.usage.outputTokens,
        totalTokens: err.usage.totalTokens,
      });
      logger.error('testing_agent.failed', { projectId: project.id, planId: plan.id, taskId, issues: err.issues });
    } else {
      logger.error('testing_agent.failed', { projectId: project.id, planId: plan.id, taskId, error: err });
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
  onStage?: OnTestingStage
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
  onStage?: OnTestingStage
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
 * `testing.operations.applyTestingOperations`: snapshot first, batch apply, restore-on-failure.
 * Mirrors `database.service.ts`'s `applyGeneration`.
 */
export async function applyGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation, project } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot apply a generation with status "${generation.status}"`);
  }

  const operations = generation.operations;
  const { preview } = await previewTestingOperations(owner, projectId, operations);

  if (!preview.valid) {
    throw ApiError.badRequest('These changes are no longer valid against the current workspace — try regenerating.', {
      errors: [...preview.errors, ...preview.conflicts],
    });
  }

  generation.status = AgentGenerationStatus.APPLYING;
  await generation.save();

  try {
    const result = await applyTestingOperations(owner, projectId, generation.taskId, operations);

    generation.status = AgentGenerationStatus.COMPLETED;
    await generation.save();

    await finishTask(generation.plan, generation.taskId, {
      status: TaskExecutionStatus.COMPLETED,
      completedAt: new Date(),
      latestGenerationId: generation._id,
    });

    logger.info('testing_agent.applied', { projectId: project.id, taskId: generation.taskId, generationId: generation.id });

    return result;
  } catch (err) {
    generation.status = AgentGenerationStatus.FAILED;
    await generation.save();
    throw err;
  }
}

/** Rejects a proposed generation — no filesystem writes ever happen here. Mirrors
 *  `database.service.ts`'s `rejectGeneration`. */
export async function rejectGeneration(owner: Types.ObjectId, projectId: string, generationId: string) {
  const { generation } = await getGenerationOrThrow(owner, projectId, generationId);

  if (generation.status !== AgentGenerationStatus.PREVIEW_READY) {
    throw ApiError.badRequest(`Cannot reject a generation with status "${generation.status}"`);
  }

  generation.status = AgentGenerationStatus.CANCELLED;
  await generation.save();

  await finishTask(generation.plan, generation.taskId, { status: TaskExecutionStatus.CANCELLED });

  logger.info('testing_agent.rejected', { projectId, taskId: generation.taskId, generationId: generation.id });

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

// ---------------------------------------------------------------------------
// Test execution (spec §30-§37, §57, §62) — separate from generation CRUD above: a `TestRun` is a
// real process execution, not a file-change proposal, so it has its own lifecycle and its own
// ownership-check entry point (`assertTestingTaskOwnership`) rather than reusing
// `getGenerationOrThrow`.
// ---------------------------------------------------------------------------

async function assertTestingTaskOwnership(owner: Types.ObjectId, projectId: string, planId: string, taskId: string) {
  const project = await getProjectById(owner, projectId);
  const plan = await plannerService.getPlan(owner, projectId, planId);
  const tasks = (plan.tasks ?? []) as IPlanTask[];
  const task = findTask(tasks, taskId);

  if (!isTestingTask(task)) {
    throw ApiError.badRequest(describeOwningAgent(task));
  }

  return { project, plan, task };
}

/** Creates a `TestRun` row (status `queued`) after verifying the caller owns the project/plan and the
 *  task genuinely belongs to the Testing Agent — mirrors every generation entry point's ownership
 *  check (spec §6). Does not itself run anything; `runTestRun` (below) does the real work. */
export async function createTestRun(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  taskId: string,
  scope: ITestRunScope
): Promise<TestRunDocument> {
  const { project, plan } = await assertTestingTaskOwnership(owner, projectId, planId, taskId);

  const latestGeneration = await AgentGenerationModel.findOne({
    plan: plan._id,
    taskId,
    agentType: 'testing',
    status: AgentGenerationStatus.COMPLETED,
  }).sort({ version: -1 });

  return TestRunModel.create({
    project: project._id,
    plan: plan._id,
    taskId,
    generationId: latestGeneration?._id,
    status: TestRunStatus.QUEUED,
    scope,
    results: [],
    logs: { stdout: '', stderr: '', truncated: false },
    createdBy: owner,
  });
}

/** Thin pass-through to `testing.runner.executeTestRun` — kept here so the controller only ever talks
 *  to `testing.service`, matching every other agent entry point's layering. */
export async function runTestRun(
  testRun: TestRunDocument,
  owner: Types.ObjectId,
  projectId: string,
  signal: AbortSignal,
  onStage?: OnTestRunStage
): Promise<TestRunDocument> {
  return executeTestRun(testRun, owner, projectId, signal, onStage);
}

export async function listTestRuns(owner: Types.ObjectId, projectId: string, planId: string, taskId: string) {
  const project = await getProjectById(owner, projectId);
  const plan = await plannerService.getPlan(owner, projectId, planId);
  return TestRunModel.find({ project: project._id, plan: plan._id, taskId }).sort({ createdAt: -1 }).limit(50);
}

export async function getTestRun(owner: Types.ObjectId, projectId: string, testRunId: string): Promise<TestRunDocument> {
  if (!Types.ObjectId.isValid(testRunId)) {
    throw ApiError.badRequest('Invalid test run id');
  }

  const project = await getProjectById(owner, projectId);
  const testRun = await TestRunModel.findOne({ _id: testRunId, project: project._id });

  if (!testRun) {
    throw ApiError.notFound('Test run not found');
  }

  return testRun;
}

/** Aborts a live run via the in-memory registry (spec §57) — returns `false` if the run already
 *  finished or was never registered (e.g. a stale id, or a different server instance). */
export function cancelTestRun(testRunId: string): boolean {
  return runRegistry.cancelRun(testRunId);
}

function getResultOrThrow(testRun: TestRunDocument, resultIndex: number) {
  const result = testRun.results[resultIndex];
  if (!result) {
    throw ApiError.notFound('Test result not found');
  }
  return result;
}

export async function explainTestFailure(
  owner: Types.ObjectId,
  projectId: string,
  testRunId: string,
  resultIndex: number,
  signal: AbortSignal
): Promise<ITestFailureAnalysis> {
  const testRun = await getTestRun(owner, projectId, testRunId);
  const result = getResultOrThrow(testRun, resultIndex);
  return analyzeFailure(owner, projectId, result, signal);
}

export async function generateTestFix(
  owner: Types.ObjectId,
  projectId: string,
  testRunId: string,
  resultIndex: number,
  signal: AbortSignal
): Promise<AgentGenerationDocument> {
  const testRun = await getTestRun(owner, projectId, testRunId);
  const result = getResultOrThrow(testRun, resultIndex);
  return generateFix(owner, projectId, testRun.plan, testRun.taskId, result, signal);
}
