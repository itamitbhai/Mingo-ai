import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AgentGenerationStatus, ProjectPlanStatus, TaskExecutionStatus } from 'shared';

vi.mock('../../config/frontendAgent.config', () => ({
  frontendAgentConfig: { MODEL: 'gpt-4o-mini' },
}));

vi.mock('../../models', () => ({
  TaskExecutionModel: {
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
  },
  AgentGenerationModel: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../../services/project.service', () => ({
  getProjectById: vi.fn(),
}));

vi.mock('../../services/usage.service', () => ({
  recordUsage: vi.fn(),
}));

vi.mock('../planner/planner.service', () => ({
  getPlan: vi.fn(),
}));

vi.mock('./frontend.context', () => ({
  buildFrontendContext: vi.fn().mockResolvedValue({}),
}));

// Defined inline so this mock never pulls in the real `frontend.agent.ts` module graph (which
// imports `config/frontendAgent.config` -> `config/env`), mirroring `planner.service.test.ts`.
vi.mock('./frontend.agent', () => {
  class FrontendValidationError extends Error {
    issues: string[];
    usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };

    constructor(issues: string[], usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }) {
      super(`Frontend Agent output failed validation after retries: ${issues.join('; ')}`);
      this.name = 'FrontendValidationError';
      this.issues = issues;
      this.usage = usage;
    }
  }

  return { runFrontendAgent: vi.fn(), FrontendValidationError };
});

vi.mock('./frontend.operations', () => ({
  previewFrontendOperations: vi.fn(),
  applyFrontendOperations: vi.fn(),
}));

import { AgentGenerationModel, TaskExecutionModel } from '../../models';
import * as projectService from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import * as plannerService from '../planner/planner.service';
import { FrontendValidationError, runFrontendAgent } from './frontend.agent';
import { applyFrontendOperations, previewFrontendOperations } from './frontend.operations';
import {
  applyGeneration,
  executeTask,
  regenerateTask,
  rejectGeneration,
} from './frontend.service';

function chainable<T>(resolved: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(resolved),
    then: (onFulfilled: (value: T) => unknown) => Promise.resolve(resolved).then(onFulfilled),
  };
}

const FRONTEND_TASK = {
  id: 'TASK-001',
  title: 'Create ProductCard',
  description: 'Build a reusable product card component',
  type: 'frontend',
  priority: 'high',
  complexity: 'small',
  dependencies: [] as string[],
  affectedFiles: ['src/components/ProductCard.tsx'],
  acceptanceCriteria: ['Renders product name and price'],
};

const VALID_OUTPUT = {
  operations: [{ type: 'create', path: 'src/components/ProductCard.tsx', content: 'x', reason: 'r' }],
  dependencyRequests: [],
};

describe('frontend.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), id: 'p1' };
  const plan = {
    _id: new Types.ObjectId(),
    id: 'plan1',
    status: ProjectPlanStatus.APPROVED,
    tasks: [FRONTEND_TASK],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
    vi.mocked(plannerService.getPlan).mockResolvedValue(plan as never);
  });

  describe('executeTask', () => {
    it('rejects when the plan is not approved', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({ ...plan, status: ProjectPlanStatus.READY } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-001', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(runFrontendAgent).not.toHaveBeenCalled();
    });

    it('rejects a task that does not belong to the Frontend Agent', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...FRONTEND_TASK, type: 'database', recommendedAgent: 'database' }],
      } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-001', new AbortController().signal)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Database Agent'),
      });

      expect(runFrontendAgent).not.toHaveBeenCalled();
    });

    it('blocks a task whose dependencies are not completed', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...FRONTEND_TASK, dependencies: ['TASK-000'] }],
      } as never);
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-001', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400, message: 'Waiting for required tasks.' });

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'TASK-001' }),
        expect.objectContaining({ $set: expect.objectContaining({ status: TaskExecutionStatus.BLOCKED }) }),
        expect.objectContaining({ upsert: true })
      );
      expect(runFrontendAgent).not.toHaveBeenCalled();
    });

    it('rejects with a conflict when the task is already running', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      const duplicateKeyError = Object.assign(new Error('duplicate'), { code: 11000 });
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockRejectedValue(duplicateKeyError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-001', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 409, message: 'Task already running.' });

      expect(runFrontendAgent).not.toHaveBeenCalled();
    });

    it('creates a preview-ready generation on success and records usage', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runFrontendAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      vi.mocked(previewFrontendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen1', version: 1 } as never);

      const generation = await executeTask(owner, 'p1', 'plan1', 'TASK-001', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AgentGenerationStatus.PREVIEW_READY, taskId: 'TASK-001' })
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'frontend_agent', totalTokens: 30 })
      );
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-001' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.READY }) }
      );
      expect((generation as { id: string }).id).toBe('gen1');
    });

    it('marks the task failed and rethrows on a validation error', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      const validationError = new FrontendValidationError(['bad output'], {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
      });
      vi.mocked(runFrontendAgent).mockRejectedValue(validationError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-001', new AbortController().signal)
      ).rejects.toBe(validationError);

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-001' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.FAILED }) }
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 10 }));
    });
  });

  describe('regenerateTask', () => {
    it('folds feedback into the generation run', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runFrontendAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      vi.mocked(previewFrontendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable({ version: 1 }) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen2', version: 2 } as never);

      await regenerateTask(owner, 'p1', 'plan1', 'TASK-001', 'Make it mobile-first', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: 'Make it mobile-first', version: 2 })
      );
    });
  });

  describe('rejectGeneration', () => {
    it('never touches the filesystem', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-001',
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await rejectGeneration(owner, 'p1', new Types.ObjectId().toString());

      expect(generation.status).toBe(AgentGenerationStatus.CANCELLED);
      expect(generation.save).toHaveBeenCalled();
      expect(applyFrontendOperations).not.toHaveBeenCalled();
    });

    it('refuses to reject a generation that is not preview-ready', async () => {
      const generation = { id: 'gen1', status: AgentGenerationStatus.COMPLETED, save: vi.fn() };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);

      await expect(rejectGeneration(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(generation.save).not.toHaveBeenCalled();
    });
  });

  describe('applyGeneration', () => {
    it('applies operations and marks the generation and task completed', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-001',
        operations: VALID_OUTPUT.operations,
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(previewFrontendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(applyFrontendOperations).mockResolvedValue({ applied: 1, operations: [] } as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await applyGeneration(owner, 'p1', new Types.ObjectId().toString());

      expect(applyFrontendOperations).toHaveBeenCalledWith(owner, 'p1', 'TASK-001', VALID_OUTPUT.operations);
      expect(generation.status).toBe(AgentGenerationStatus.COMPLETED);
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-001' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.COMPLETED }) }
      );
    });

    it('refuses to apply when the current workspace state invalidates the preview', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-001',
        operations: VALID_OUTPUT.operations,
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn(),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(previewFrontendOperations).mockResolvedValue({
        preview: { valid: false, operations: [], warnings: [], errors: ['conflict'], conflicts: [] },
        operationsWithDiff: [],
      });

      await expect(applyGeneration(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(applyFrontendOperations).not.toHaveBeenCalled();
    });
  });
});
