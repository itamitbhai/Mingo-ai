import { Types } from 'mongoose';
import { IPlanDiff, IPlanDiffChange, IPlanFeature, IPlanStack, IPlanStackEntry, IPlanTask, ProjectPlanStatus } from 'shared';
import { ProjectPlanDocument, ProjectPlanModel } from '../../models';
import * as aiService from '../../services/ai/ai.service';
import { getProjectById } from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta } from '../../utils/paginate';
import { logger } from '../../utils/logger';
import { buildPlannerContext } from '../context/project-context.builder';
import { PlannerValidationError, runPlannerAgent } from './planner.agent';
import { planOutputSchema } from './planner.schema';
import { OnPlannerStage } from './planner.types';

function zodIssuesToErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path.join('.') || 'plan';
    acc[key] = [...(acc[key] ?? []), issue.message];
    return acc;
  }, {});
}

async function getNextVersion(project: Types.ObjectId): Promise<number> {
  const latest = await ProjectPlanModel.findOne({ project }).sort({ version: -1 }).select('version');
  return (latest?.version ?? 0) + 1;
}

/**
 * Runs the Planner Agent for `prompt` and persists the result as a new `ProjectPlan` version for
 * this project. On an unrecoverable validation failure, a `status: 'failed'` plan is still
 * persisted (prompt + friendly error only) so failures stay auditable (spec §38), and the error is
 * rethrown for the controller to turn into an SSE `error` frame.
 */
export async function generatePlan(
  owner: Types.ObjectId,
  projectId: string,
  prompt: string,
  conversationId: string | undefined,
  signal: AbortSignal,
  onStage?: OnPlannerStage
): Promise<ProjectPlanDocument> {
  const project = await getProjectById(owner, projectId);

  logger.info('planner.started', { projectId: project.id, userId: owner.toString() });
  onStage?.({ stage: 'loading_context', label: 'Loading project context…' });

  const context = await buildPlannerContext(owner, projectId, conversationId);

  try {
    const { output, usage } = await runPlannerAgent({ context, prompt, signal, onStage });

    onStage?.({ stage: 'saving', label: 'Saving the plan…' });

    const version = await getNextVersion(project._id);
    const plan = await ProjectPlanModel.create({
      project: project._id,
      owner,
      conversation: conversationId,
      version,
      status: ProjectPlanStatus.READY,
      prompt,
      ...output,
    });

    await usageService.recordUsage({
      userId: owner,
      projectId: project._id,
      conversationId: conversationId ? new Types.ObjectId(conversationId) : undefined,
      modelName: aiService.getModelName(),
      purpose: 'planner',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });

    logger.info('planner.completed', { projectId: project.id, planId: plan.id, version });
    logger.info('plan.created', { planId: plan.id, projectId: project.id, version });
    onStage?.({ stage: 'done', label: 'Plan ready.' });

    return plan;
  } catch (err) {
    if (err instanceof PlannerValidationError) {
      logger.error('planner.failed', { projectId: project.id, issues: err.issues });

      const version = await getNextVersion(project._id);
      await ProjectPlanModel.create({
        project: project._id,
        owner,
        conversation: conversationId,
        version,
        status: ProjectPlanStatus.FAILED,
        prompt,
        error: 'The planner could not produce a valid plan after multiple attempts. Please try rephrasing your request.',
      });

      await usageService.recordUsage({
        userId: owner,
        projectId: project._id,
        conversationId: conversationId ? new Types.ObjectId(conversationId) : undefined,
        modelName: aiService.getModelName(),
        purpose: 'planner',
        inputTokens: err.usage.inputTokens,
        outputTokens: err.usage.outputTokens,
        totalTokens: err.usage.totalTokens,
      });
    } else {
      logger.error('planner.failed', err);
    }

    throw err;
  }
}

export async function listPlans(owner: Types.ObjectId, projectId: string, page: number, limit: number) {
  const project = await getProjectById(owner, projectId);
  const filter = { project: project._id, owner };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ProjectPlanModel.find(filter).sort({ version: -1 }).skip(skip).limit(limit),
    ProjectPlanModel.countDocuments(filter),
  ]);

  return { items, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getPlan(
  owner: Types.ObjectId,
  projectId: string,
  planId: string
): Promise<ProjectPlanDocument> {
  if (!Types.ObjectId.isValid(planId)) {
    throw ApiError.badRequest('Invalid plan id');
  }

  const project = await getProjectById(owner, projectId);
  const plan = await ProjectPlanModel.findOne({ _id: planId, project: project._id, owner });

  if (!plan) {
    throw ApiError.notFound('Plan not found');
  }

  return plan;
}

const STACK_KEYS = [
  'frontend',
  'backend',
  'database',
  'authentication',
  'payments',
  'storage',
  'styling',
  'testing',
  'deployment',
] as const;

/** A plain structural diff (added/removed/changed by id, plus per-category stack changes) — not a
 *  text/line diff (spec §54). */
export function diffPlans(previous: ProjectPlanDocument, next: ProjectPlanDocument): IPlanDiff {
  const prevFeatures = (previous.features ?? []) as IPlanFeature[];
  const nextFeatures = (next.features ?? []) as IPlanFeature[];
  const prevTasks = (previous.tasks ?? []) as IPlanTask[];
  const nextTasks = (next.tasks ?? []) as IPlanTask[];

  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
  const prevFeatureMap = byId(prevFeatures);
  const nextFeatureMap = byId(nextFeatures);
  const prevTaskMap = byId(prevTasks);
  const nextTaskMap = byId(nextTasks);

  const featuresAdded = nextFeatures.filter((f) => !prevFeatureMap.has(f.id));
  const featuresRemoved = prevFeatures.filter((f) => !nextFeatureMap.has(f.id));
  const featuresChanged: IPlanDiffChange<IPlanFeature>[] = nextFeatures
    .filter((f) => prevFeatureMap.has(f.id) && JSON.stringify(prevFeatureMap.get(f.id)) !== JSON.stringify(f))
    .map((f) => ({ before: prevFeatureMap.get(f.id) as IPlanFeature, after: f }));

  const tasksAdded = nextTasks.filter((t) => !prevTaskMap.has(t.id));
  const tasksRemoved = prevTasks.filter((t) => !nextTaskMap.has(t.id));
  const tasksChanged: IPlanDiffChange<IPlanTask>[] = nextTasks
    .filter((t) => prevTaskMap.has(t.id) && JSON.stringify(prevTaskMap.get(t.id)) !== JSON.stringify(t))
    .map((t) => ({ before: prevTaskMap.get(t.id) as IPlanTask, after: t }));

  const previousStack = (previous.stack ?? {}) as IPlanStack;
  const nextStack = (next.stack ?? {}) as IPlanStack;
  const stackChanged = STACK_KEYS.filter(
    (key) => JSON.stringify(previousStack[key]) !== JSON.stringify(nextStack[key])
  ).map((key) => ({
    key,
    before: previousStack[key] as IPlanStackEntry | undefined,
    after: nextStack[key] as IPlanStackEntry | undefined,
  }));

  return { featuresAdded, featuresRemoved, featuresChanged, tasksAdded, tasksRemoved, tasksChanged, stackChanged };
}

export interface RegeneratePlanResult {
  plan: ProjectPlanDocument;
  previousPlan: ProjectPlanDocument;
  diff: IPlanDiff;
}

export async function regeneratePlan(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  promptOverride: string | undefined,
  signal: AbortSignal,
  onStage?: OnPlannerStage
): Promise<RegeneratePlanResult> {
  const previousPlan = await getPlan(owner, projectId, planId);
  const prompt = promptOverride ?? previousPlan.prompt;

  const plan = await generatePlan(
    owner,
    projectId,
    prompt,
    previousPlan.conversation?.toString(),
    signal,
    onStage
  );

  const diff = diffPlans(previousPlan, plan);
  logger.info('plan.regenerated', { previousPlanId: previousPlan.id, newPlanId: plan.id });

  return { plan, previousPlan, diff };
}

export async function updatePlanStatus(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  status: 'approved' | 'rejected'
): Promise<ProjectPlanDocument> {
  const plan = await getPlan(owner, projectId, planId);

  if (plan.status !== ProjectPlanStatus.READY) {
    throw ApiError.badRequest(`Cannot ${status} a plan with status "${plan.status}"`);
  }

  plan.status = status === 'approved' ? ProjectPlanStatus.APPROVED : ProjectPlanStatus.REJECTED;
  await plan.save();

  logger.info(status === 'approved' ? 'plan.approved' : 'plan.rejected', { planId: plan.id });

  return plan;
}

interface FeatureEdit {
  id: string;
  title?: string;
  description?: string;
  priority?: string;
}

interface TaskEdit {
  id: string;
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
}

/** Merges only the whitelisted fields (spec §52) into the matching `id` within the stored
 *  `features`/`tasks` — never a wholesale array replacement — then re-validates the whole plan
 *  before saving. */
export async function updatePlanFields(
  owner: Types.ObjectId,
  projectId: string,
  planId: string,
  edits: { featureEdits?: FeatureEdit[]; taskEdits?: TaskEdit[] }
): Promise<ProjectPlanDocument> {
  const plan = await getPlan(owner, projectId, planId);

  const features = [...((plan.features ?? []) as IPlanFeature[])];
  const tasks = [...((plan.tasks ?? []) as IPlanTask[])];

  for (const edit of edits.featureEdits ?? []) {
    const index = features.findIndex((feature) => feature.id === edit.id);
    if (index === -1) {
      throw ApiError.badRequest(`Feature "${edit.id}" not found in this plan`);
    }
    const current = features[index];
    features[index] = {
      ...current,
      name: edit.title ?? current.name,
      description: edit.description ?? current.description,
      priority: (edit.priority as IPlanFeature['priority']) ?? current.priority,
    };
  }

  for (const edit of edits.taskEdits ?? []) {
    const index = tasks.findIndex((task) => task.id === edit.id);
    if (index === -1) {
      throw ApiError.badRequest(`Task "${edit.id}" not found in this plan`);
    }
    const current = tasks[index];
    tasks[index] = {
      ...current,
      title: edit.title ?? current.title,
      description: edit.description ?? current.description,
      acceptanceCriteria: edit.acceptanceCriteria ?? current.acceptanceCriteria,
    };
  }

  const candidate = {
    summary: plan.summary,
    projectType: plan.projectType,
    requirements: plan.requirements,
    stack: plan.stack,
    architecture: plan.architecture,
    features,
    database: plan.database,
    api: plan.api,
    frontend: plan.frontend,
    files: plan.files,
    tasks,
    executionOrder: plan.executionOrder,
    risks: plan.risks,
    assumptions: plan.assumptions,
    security: plan.security,
    nonFunctionalRequirements: plan.nonFunctionalRequirements,
    conflicts: plan.conflicts,
  };

  const validation = planOutputSchema.safeParse(candidate);
  if (!validation.success) {
    throw ApiError.badRequest('Edited plan failed validation', zodIssuesToErrors(validation.error.issues));
  }

  plan.features = features;
  plan.tasks = tasks;
  await plan.save();

  return plan;
}

const DELETABLE_STATUSES: ProjectPlanStatus[] = [
  ProjectPlanStatus.DRAFT,
  ProjectPlanStatus.REJECTED,
  ProjectPlanStatus.FAILED,
];

export async function deletePlan(owner: Types.ObjectId, projectId: string, planId: string): Promise<void> {
  const plan = await getPlan(owner, projectId, planId);

  if (!DELETABLE_STATUSES.includes(plan.status)) {
    throw ApiError.badRequest(`Cannot delete a plan with status "${plan.status}"`);
  }

  await plan.deleteOne();
  logger.info('plan.deleted', { planId: plan.id });
}
