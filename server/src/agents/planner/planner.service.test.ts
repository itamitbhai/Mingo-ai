import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { ProjectPlanStatus } from 'shared';

vi.mock('../../models', () => ({
  ProjectPlanModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../../services/project.service', () => ({
  getProjectById: vi.fn(),
}));

vi.mock('../../services/usage.service', () => ({
  recordUsage: vi.fn(),
}));

vi.mock('../../services/ai/ai.service', () => ({
  getModelName: vi.fn().mockReturnValue('gpt-4o-mini'),
}));

vi.mock('../context/project-context.builder', () => ({
  buildPlannerContext: vi.fn().mockResolvedValue({}),
}));

// Defined inline (rather than via `vi.importActual`) so this mock never pulls in the real
// `planner.agent.ts` module graph, which imports `config/env` and would fail outside a fully
// configured environment.
vi.mock('./planner.agent', () => {
  class PlannerValidationError extends Error {
    issues: string[];
    usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };

    constructor(
      issues: string[],
      usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }
    ) {
      super(`Planner output failed validation after retries: ${issues.join('; ')}`);
      this.name = 'PlannerValidationError';
      this.issues = issues;
      this.usage = usage;
    }
  }

  return {
    runPlannerAgent: vi.fn(),
    PlannerValidationError,
  };
});

import { ProjectPlanModel } from '../../models';
import * as projectService from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import { PlannerValidationError, runPlannerAgent } from './planner.agent';
import {
  deletePlan,
  diffPlans,
  generatePlan,
  getPlan,
  listPlans,
  regeneratePlan,
  updatePlanFields,
  updatePlanStatus,
} from './planner.service';

function chainable<T>(resolved: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolved),
    then: (onFulfilled: (value: T) => unknown) => Promise.resolve(resolved).then(onFulfilled),
  };
}

const VALID_OUTPUT = {
  summary: 'A todo app',
  projectType: 'Productivity',
  requirements: { explicit: [], inferred: [], missing: [] },
  stack: {},
  architecture: { description: '', nodes: [], edges: [] },
  features: [{ id: 'F-1', name: 'Auth', description: '', priority: 'high', complexity: 'medium', requirements: [] }],
  database: { entities: [], relationships: [] },
  api: [],
  frontend: { pages: [], components: [], hooks: [], state: [] },
  files: [],
  tasks: [
    {
      id: 'TASK-001',
      title: 'Set up project',
      description: '',
      type: 'setup',
      priority: 'high',
      complexity: 'small',
      dependencies: [],
      affectedFiles: [],
      acceptanceCriteria: ['Builds successfully'],
    },
  ],
  executionOrder: ['TASK-001'],
  risks: [],
  assumptions: [],
  security: [],
  nonFunctionalRequirements: [],
  conflicts: [],
};

describe('planner.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), frontend: 'React' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
  });

  describe('generatePlan', () => {
    it('creates version 1 when no plan exists yet for the project', async () => {
      vi.mocked(ProjectPlanModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(runPlannerAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      vi.mocked(ProjectPlanModel.create).mockResolvedValue({ id: 'plan1', version: 1 } as never);

      await generatePlan(owner, 'p1', 'Build a todo app', undefined, new AbortController().signal);

      expect(ProjectPlanModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1, status: ProjectPlanStatus.READY })
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'planner', totalTokens: 30 })
      );
    });

    it('increments the version from the latest existing plan', async () => {
      vi.mocked(ProjectPlanModel.findOne).mockReturnValue(chainable({ version: 4 }) as never);
      vi.mocked(runPlannerAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      vi.mocked(ProjectPlanModel.create).mockResolvedValue({ id: 'plan5', version: 5 } as never);

      await generatePlan(owner, 'p1', 'Build a todo app', undefined, new AbortController().signal);

      expect(ProjectPlanModel.create).toHaveBeenCalledWith(expect.objectContaining({ version: 5 }));
    });

    it('persists a failed plan and rethrows when the agent cannot produce a valid plan', async () => {
      vi.mocked(ProjectPlanModel.findOne).mockReturnValue(chainable(null) as never);
      const validationError = new PlannerValidationError(['bad output'], {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
      });
      vi.mocked(runPlannerAgent).mockRejectedValue(validationError);
      vi.mocked(ProjectPlanModel.create).mockResolvedValue({ id: 'plan-failed' } as never);

      await expect(
        generatePlan(owner, 'p1', 'Build a todo app', undefined, new AbortController().signal)
      ).rejects.toBe(validationError);

      expect(ProjectPlanModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProjectPlanStatus.FAILED })
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 10 }));
    });
  });

  describe('listPlans', () => {
    it('returns paginated plans sorted newest-version-first', async () => {
      vi.mocked(ProjectPlanModel.find).mockReturnValue(chainable([{ version: 2 }]) as never);
      vi.mocked(ProjectPlanModel.countDocuments).mockResolvedValue(1 as never);

      const result = await listPlans(owner, 'p1', 1, 10);

      expect(result.items).toEqual([{ version: 2 }]);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getPlan', () => {
    it('throws a 400 for a malformed plan id', async () => {
      await expect(getPlan(owner, 'p1', 'not-an-id')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws a 404 when the plan does not belong to this owner/project', async () => {
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(null);
      await expect(getPlan(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('updatePlanStatus', () => {
    it('approves a ready plan', async () => {
      const plan = { status: ProjectPlanStatus.READY, save: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(plan as never);

      const result = await updatePlanStatus(owner, 'p1', new Types.ObjectId().toString(), 'approved');

      expect(result.status).toBe(ProjectPlanStatus.APPROVED);
      expect(plan.save).toHaveBeenCalled();
    });

    it('rejects approving a plan that is not ready', async () => {
      const plan = { status: ProjectPlanStatus.APPROVED, save: vi.fn() };
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(plan as never);

      await expect(
        updatePlanStatus(owner, 'p1', new Types.ObjectId().toString(), 'approved')
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(plan.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePlanFields', () => {
    it('merges a feature edit by id without replacing the whole array', async () => {
      const plan = {
        summary: 'x',
        projectType: 'y',
        requirements: { explicit: [], inferred: [], missing: [] },
        stack: {},
        architecture: { description: '', nodes: [], edges: [] },
        features: [{ id: 'F-1', name: 'Old name', description: 'd', priority: 'low', complexity: 'small', requirements: [] }],
        database: { entities: [], relationships: [] },
        api: [],
        frontend: { pages: [], components: [], hooks: [], state: [] },
        files: [],
        tasks: VALID_OUTPUT.tasks,
        executionOrder: VALID_OUTPUT.executionOrder,
        risks: [],
        assumptions: [],
        security: [],
        nonFunctionalRequirements: [],
        conflicts: [],
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(plan as never);

      const result = await updatePlanFields(owner, 'p1', new Types.ObjectId().toString(), {
        featureEdits: [{ id: 'F-1', title: 'New name' }],
      });

      expect((result.features as { id: string; name: string }[])[0].name).toBe('New name');
      expect(plan.save).toHaveBeenCalled();
    });

    it('throws when editing a feature id that does not exist on the plan', async () => {
      const plan = { features: [], tasks: VALID_OUTPUT.tasks, executionOrder: VALID_OUTPUT.executionOrder, save: vi.fn() };
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(plan as never);

      await expect(
        updatePlanFields(owner, 'p1', new Types.ObjectId().toString(), {
          featureEdits: [{ id: 'missing', title: 'x' }],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(plan.save).not.toHaveBeenCalled();
    });
  });

  describe('deletePlan', () => {
    it('deletes a draft plan', async () => {
      const plan = { status: ProjectPlanStatus.DRAFT, deleteOne: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(plan as never);

      await deletePlan(owner, 'p1', new Types.ObjectId().toString());
      expect(plan.deleteOne).toHaveBeenCalled();
    });

    it('refuses to delete an approved plan', async () => {
      const plan = { status: ProjectPlanStatus.APPROVED, deleteOne: vi.fn() };
      vi.mocked(ProjectPlanModel.findOne).mockResolvedValue(plan as never);

      await expect(deletePlan(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(plan.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('regeneratePlan', () => {
    it('reuses the previous prompt when none is given and returns a diff', async () => {
      const previousPlan = {
        id: 'plan-prev',
        prompt: 'Build a todo app',
        conversation: undefined,
        features: [],
        tasks: [],
        stack: {},
      };
      vi.mocked(ProjectPlanModel.findOne)
        .mockResolvedValueOnce(previousPlan as never) // getPlan(planId) inside regeneratePlan
        .mockReturnValueOnce(chainable({ version: 1 }) as never); // getNextVersion inside generatePlan

      vi.mocked(runPlannerAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      const newPlan = { id: 'plan-new', ...VALID_OUTPUT };
      vi.mocked(ProjectPlanModel.create).mockResolvedValue(newPlan as never);

      const result = await regeneratePlan(
        owner,
        'p1',
        new Types.ObjectId().toString(),
        undefined,
        new AbortController().signal
      );

      expect(result.previousPlan).toBe(previousPlan);
      expect(result.plan).toBe(newPlan);
      expect(result.diff.featuresAdded).toHaveLength(1);

      const generatedUserPromptCall = vi.mocked(runPlannerAgent).mock.calls[0][0];
      expect(generatedUserPromptCall.prompt).toBe('Build a todo app');
    });
  });

  describe('diffPlans', () => {
    it('detects added, removed, and changed features/tasks', () => {
      const previous = {
        features: [{ id: 'F-1', name: 'A' }, { id: 'F-2', name: 'B' }],
        tasks: [{ id: 'T-1', title: 'X' }],
        stack: { frontend: { name: 'React', source: 'user_selected' } },
      };
      const next = {
        features: [{ id: 'F-1', name: 'A changed' }, { id: 'F-3', name: 'C' }],
        tasks: [{ id: 'T-1', title: 'X' }, { id: 'T-2', title: 'Y' }],
        stack: { frontend: { name: 'Next.js', source: 'user_selected' } },
      };

      const diff = diffPlans(previous as never, next as never);

      expect(diff.featuresAdded.map((f) => f.id)).toEqual(['F-3']);
      expect(diff.featuresRemoved.map((f) => f.id)).toEqual(['F-2']);
      expect(diff.featuresChanged.map((c) => c.after.id)).toEqual(['F-1']);
      expect(diff.tasksAdded.map((t) => t.id)).toEqual(['T-2']);
      expect(diff.stackChanged).toEqual([
        { key: 'frontend', before: { name: 'React', source: 'user_selected' }, after: { name: 'Next.js', source: 'user_selected' } },
      ]);
    });
  });
});
