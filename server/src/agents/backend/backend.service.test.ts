import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AgentGenerationStatus, ProjectPlanStatus, TaskExecutionStatus } from 'shared';

vi.mock('../../config/backendAgent.config', () => ({
  backendAgentConfig: { MODEL: 'gpt-4o-mini' },
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

vi.mock('./backend.context', () => ({
  buildBackendContext: vi.fn().mockResolvedValue({}),
}));

// Defined inline so this mock never pulls in the real `backend.agent.ts` module graph (which
// imports `config/backendAgent.config` -> `config/env`), mirroring `frontend.service.test.ts`.
vi.mock('./backend.agent', () => {
  class BackendValidationError extends Error {
    issues: string[];
    usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };

    constructor(issues: string[], usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }) {
      super(`Backend Agent output failed validation after retries: ${issues.join('; ')}`);
      this.name = 'BackendValidationError';
      this.issues = issues;
      this.usage = usage;
    }
  }

  return { runBackendAgent: vi.fn(), BackendValidationError };
});

vi.mock('./backend.operations', () => ({
  previewBackendOperations: vi.fn(),
  applyBackendOperations: vi.fn(),
}));

import { AgentGenerationModel, TaskExecutionModel } from '../../models';
import * as projectService from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import * as plannerService from '../planner/planner.service';
import { BackendValidationError, runBackendAgent } from './backend.agent';
import { applyBackendOperations, previewBackendOperations } from './backend.operations';
import {
  applyGeneration,
  executeTask,
  isBackendTask,
  regenerateTask,
  rejectGeneration,
} from './backend.service';

function chainable<T>(resolved: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(resolved),
    then: (onFulfilled: (value: T) => unknown) => Promise.resolve(resolved).then(onFulfilled),
  };
}

const BACKEND_TASK = {
  id: 'TASK-011',
  title: 'Create Todo CRUD API',
  description: 'Build Express routes/controllers/services for Todo CRUD',
  type: 'backend',
  priority: 'high',
  complexity: 'medium',
  dependencies: [] as string[],
  affectedFiles: ['server/routes/todo.routes.js'],
  acceptanceCriteria: ['POST/GET/PATCH/DELETE /api/todos work'],
};

const VALID_OUTPUT = {
  operations: [{ type: 'create', path: 'server/routes/todo.routes.js', content: 'x', reason: 'r' }],
  dependencyRequests: [],
  apiContracts: [{ method: 'GET', path: '/api/todos', authentication: true }],
};

describe('backend.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), id: 'p1' };
  const plan = {
    _id: new Types.ObjectId(),
    id: 'plan1',
    status: ProjectPlanStatus.APPROVED,
    tasks: [BACKEND_TASK],
    api: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
    vi.mocked(plannerService.getPlan).mockResolvedValue(plan as never);
  });

  describe('isBackendTask', () => {
    it('matches on type', () => {
      expect(isBackendTask({ ...BACKEND_TASK, recommendedAgent: undefined } as never)).toBe(true);
    });

    it('matches on recommendedAgent even with a different type', () => {
      expect(isBackendTask({ ...BACKEND_TASK, type: 'integration', recommendedAgent: 'backend' } as never)).toBe(true);
    });

    it('rejects a frontend task', () => {
      expect(isBackendTask({ ...BACKEND_TASK, type: 'frontend', recommendedAgent: undefined } as never)).toBe(false);
    });
  });

  describe('executeTask', () => {
    it('rejects when the plan is not approved', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({ ...plan, status: ProjectPlanStatus.READY } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(runBackendAgent).not.toHaveBeenCalled();
    });

    it('rejects a task that does not belong to the Backend Agent', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...BACKEND_TASK, type: 'frontend', recommendedAgent: 'frontend' }],
      } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Frontend Agent'),
      });

      expect(runBackendAgent).not.toHaveBeenCalled();
    });

    it('blocks a task whose dependencies are not completed', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...BACKEND_TASK, dependencies: ['TASK-010'] }],
      } as never);
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400, message: 'Waiting for required tasks.' });

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'TASK-011' }),
        expect.objectContaining({ $set: expect.objectContaining({ status: TaskExecutionStatus.BLOCKED }) }),
        expect.objectContaining({ upsert: true })
      );
      expect(runBackendAgent).not.toHaveBeenCalled();
    });

    it('rejects with a conflict when the task is already running', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      const duplicateKeyError = Object.assign(new Error('duplicate'), { code: 11000 });
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockRejectedValue(duplicateKeyError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 409, message: 'Task already running.' });

      expect(runBackendAgent).not.toHaveBeenCalled();
    });

    it('creates a preview-ready generation on success, records usage, and stores apiContracts', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runBackendAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      vi.mocked(previewBackendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen1', version: 1 } as never);

      const generation = await executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AgentGenerationStatus.PREVIEW_READY,
          taskId: 'TASK-011',
          agentType: 'backend',
          apiContracts: VALID_OUTPUT.apiContracts,
          contractWarnings: [],
        })
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'backend_agent', totalTokens: 30 })
      );
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-011' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.READY }) }
      );
      expect((generation as { id: string }).id).toBe('gen1');
    });

    it('flags a generated endpoint that is not in the approved plan API surface', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        api: [{ method: 'POST', path: '/api/todos', purpose: 'Create a todo', authRequired: true }],
      } as never);
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runBackendAgent).mockResolvedValue({
        output: VALID_OUTPUT as never, // GET /api/todos — not in the approved list above
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      vi.mocked(previewBackendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen1', version: 1 } as never);

      await executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contractWarnings: [expect.stringContaining('API contract conflict')],
        })
      );
    });

    it('marks the task failed and rethrows on a validation error', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      const validationError = new BackendValidationError(['bad output'], {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
      });
      vi.mocked(runBackendAgent).mockRejectedValue(validationError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-011', new AbortController().signal)
      ).rejects.toBe(validationError);

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-011' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.FAILED }) }
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 10 }));
    });
  });

  describe('regenerateTask', () => {
    it('folds feedback into the generation run', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runBackendAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      vi.mocked(previewBackendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable({ version: 1 }) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen2', version: 2 } as never);

      await regenerateTask(owner, 'p1', 'plan1', 'TASK-011', 'Use the existing error middleware', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: 'Use the existing error middleware', version: 2 })
      );
    });
  });

  describe('rejectGeneration', () => {
    it('never touches the filesystem', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-011',
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await rejectGeneration(owner, 'p1', new Types.ObjectId().toString());

      expect(generation.status).toBe(AgentGenerationStatus.CANCELLED);
      expect(generation.save).toHaveBeenCalled();
      expect(applyBackendOperations).not.toHaveBeenCalled();
    });
  });

  describe('applyGeneration', () => {
    it('applies operations and marks the generation and task completed', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-011',
        operations: VALID_OUTPUT.operations,
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(previewBackendOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(applyBackendOperations).mockResolvedValue({ applied: 1, operations: [] } as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await applyGeneration(owner, 'p1', new Types.ObjectId().toString());

      expect(applyBackendOperations).toHaveBeenCalledWith(owner, 'p1', 'TASK-011', VALID_OUTPUT.operations);
      expect(generation.status).toBe(AgentGenerationStatus.COMPLETED);
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-011' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.COMPLETED }) }
      );
    });

    it('refuses to apply when the current workspace state invalidates the preview', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-011',
        operations: VALID_OUTPUT.operations,
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn(),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(previewBackendOperations).mockResolvedValue({
        preview: { valid: false, operations: [], warnings: [], errors: ['conflict'], conflicts: [] },
        operationsWithDiff: [],
      });

      await expect(applyGeneration(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(applyBackendOperations).not.toHaveBeenCalled();
    });
  });
});
