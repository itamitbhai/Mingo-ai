import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AgentGenerationStatus, ProjectPlanStatus, TaskExecutionStatus } from 'shared';

vi.mock('../../config/databaseAgent.config', () => ({
  databaseAgentConfig: { MODEL: 'gpt-4o-mini' },
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

vi.mock('./database.context', () => ({
  buildDatabaseContext: vi.fn().mockResolvedValue({ requiredFieldPlan: [] }),
}));

// Defined inline so this mock never pulls in the real `database.agent.ts` module graph (which
// imports `config/databaseAgent.config` -> `config/env`), mirroring `backend.service.test.ts`.
vi.mock('./database.agent', () => {
  class DatabaseValidationError extends Error {
    issues: string[];
    usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };

    constructor(issues: string[], usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }) {
      super(`Database Agent output failed validation after retries: ${issues.join('; ')}`);
      this.name = 'DatabaseValidationError';
      this.issues = issues;
      this.usage = usage;
    }
  }

  return { runDatabaseAgent: vi.fn(), DatabaseValidationError };
});

vi.mock('./database.operations', () => ({
  previewDatabaseOperations: vi.fn(),
  applyDatabaseOperations: vi.fn(),
}));

import { AgentGenerationModel, TaskExecutionModel } from '../../models';
import * as projectService from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import * as plannerService from '../planner/planner.service';
import { buildDatabaseContext } from './database.context';
import { DatabaseValidationError, runDatabaseAgent } from './database.agent';
import { applyDatabaseOperations, previewDatabaseOperations } from './database.operations';
import {
  applyGeneration,
  executeTask,
  getProjectDatabaseSchema,
  isDatabaseTask,
  regenerateTask,
  rejectGeneration,
} from './database.service';

function chainable<T>(resolved: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(resolved),
    then: (onFulfilled: (value: T) => unknown) => Promise.resolve(resolved).then(onFulfilled),
  };
}

function findChainable<T>(resolved: T) {
  return { sort: vi.fn().mockResolvedValue(resolved) };
}

const DATABASE_TASK = {
  id: 'TASK-010',
  title: 'Create Todo MongoDB model',
  description: 'Design and generate the Todo Mongoose schema/model',
  type: 'database',
  priority: 'high',
  complexity: 'medium',
  dependencies: [] as string[],
  affectedFiles: ['server/models/Todo.js'],
  acceptanceCriteria: ['Todo schema has title, completed, userId'],
};

const VALID_OUTPUT = {
  operations: [{ type: 'create', path: 'server/models/Todo.js', content: 'x', reason: 'r' }],
  dependencyRequests: [],
  schemaContracts: [
    { model: 'Todo', collection: 'todos', fields: { title: { type: 'String', required: true } }, indexes: [] },
  ],
  databaseChanges: [{ type: 'model', model: 'Todo', reason: 'New Todo model' }],
};

describe('database.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), id: 'p1' };
  const plan = {
    _id: new Types.ObjectId(),
    id: 'plan1',
    status: ProjectPlanStatus.APPROVED,
    tasks: [DATABASE_TASK],
    database: undefined,
    api: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
    vi.mocked(plannerService.getPlan).mockResolvedValue(plan as never);
    vi.mocked(AgentGenerationModel.find).mockReturnValue(findChainable([]) as never);
    vi.mocked(buildDatabaseContext).mockResolvedValue({ requiredFieldPlan: [] } as never);
  });

  describe('isDatabaseTask', () => {
    it('matches on type', () => {
      expect(isDatabaseTask({ ...DATABASE_TASK, recommendedAgent: undefined } as never)).toBe(true);
    });

    it('matches on recommendedAgent even with a different type', () => {
      expect(isDatabaseTask({ ...DATABASE_TASK, type: 'integration', recommendedAgent: 'database' } as never)).toBe(true);
    });

    it('rejects a backend task', () => {
      expect(isDatabaseTask({ ...DATABASE_TASK, type: 'backend', recommendedAgent: undefined } as never)).toBe(false);
    });
  });

  describe('executeTask', () => {
    it('rejects when the plan is not approved', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({ ...plan, status: ProjectPlanStatus.READY } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(runDatabaseAgent).not.toHaveBeenCalled();
    });

    it('rejects a task that does not belong to the Database Agent', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...DATABASE_TASK, type: 'backend', recommendedAgent: 'backend' }],
      } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Backend Agent'),
      });

      expect(runDatabaseAgent).not.toHaveBeenCalled();
    });

    it('blocks a task whose dependencies are not completed', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...DATABASE_TASK, dependencies: ['TASK-009'] }],
      } as never);
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400, message: 'Waiting for required tasks.' });

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'TASK-010' }),
        expect.objectContaining({ $set: expect.objectContaining({ status: TaskExecutionStatus.BLOCKED }) }),
        expect.objectContaining({ upsert: true })
      );
      expect(runDatabaseAgent).not.toHaveBeenCalled();
    });

    it('rejects with a conflict when the task is already running', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      const duplicateKeyError = Object.assign(new Error('duplicate'), { code: 11000 });
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockRejectedValue(duplicateKeyError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 409, message: 'Task already running.' });

      expect(runDatabaseAgent).not.toHaveBeenCalled();
    });

    it('creates a preview-ready generation on success, records usage, and stores schema metadata', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runDatabaseAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      vi.mocked(previewDatabaseOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen1', version: 1 } as never);

      const generation = await executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AgentGenerationStatus.PREVIEW_READY,
          taskId: 'TASK-010',
          agentType: 'database',
          schemaContracts: VALID_OUTPUT.schemaContracts,
          databaseChanges: VALID_OUTPUT.databaseChanges,
          contractWarnings: [],
        })
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'database_agent', totalTokens: 30 })
      );
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-010' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.READY }) }
      );
      expect((generation as { id: string }).id).toBe('gen1');
    });

    it('flags a generated schema missing a field required by the plan/backend contract', async () => {
      vi.mocked(buildDatabaseContext).mockResolvedValue({
        requiredFieldPlan: [{ model: 'Todo', requiredFields: ['title', 'completed'] }],
      } as never);
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runDatabaseAgent).mockResolvedValue({
        output: VALID_OUTPUT as never, // only has "title", missing "completed"
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      vi.mocked(previewDatabaseOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen1', version: 1 } as never);

      await executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contractWarnings: [expect.stringContaining('missing field "completed"')],
        })
      );
    });

    it('marks the task failed and rethrows on a validation error', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      const validationError = new DatabaseValidationError(['bad output'], {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
      });
      vi.mocked(runDatabaseAgent).mockRejectedValue(validationError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-010', new AbortController().signal)
      ).rejects.toBe(validationError);

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-010' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.FAILED }) }
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 10 }));
    });
  });

  describe('regenerateTask', () => {
    it('folds feedback into the generation run', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runDatabaseAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      vi.mocked(previewDatabaseOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable({ version: 1 }) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen2', version: 2 } as never);

      await regenerateTask(owner, 'p1', 'plan1', 'TASK-010', 'Add a unique index on email', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: 'Add a unique index on email', version: 2 })
      );
    });
  });

  describe('rejectGeneration', () => {
    it('never touches the filesystem', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-010',
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await rejectGeneration(owner, 'p1', new Types.ObjectId().toString());

      expect(generation.status).toBe(AgentGenerationStatus.CANCELLED);
      expect(generation.save).toHaveBeenCalled();
      expect(applyDatabaseOperations).not.toHaveBeenCalled();
    });
  });

  describe('applyGeneration', () => {
    it('applies operations and marks the generation and task completed', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-010',
        operations: VALID_OUTPUT.operations,
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(previewDatabaseOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(applyDatabaseOperations).mockResolvedValue({ applied: 1, operations: [] } as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await applyGeneration(owner, 'p1', new Types.ObjectId().toString());

      expect(applyDatabaseOperations).toHaveBeenCalledWith(owner, 'p1', 'TASK-010', VALID_OUTPUT.operations);
      expect(generation.status).toBe(AgentGenerationStatus.COMPLETED);
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-010' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.COMPLETED }) }
      );
    });

    it('refuses to apply when the current workspace state invalidates the preview', async () => {
      const generation = {
        id: 'gen1',
        plan: plan._id,
        taskId: 'TASK-010',
        operations: VALID_OUTPUT.operations,
        status: AgentGenerationStatus.PREVIEW_READY,
        save: vi.fn(),
      };
      vi.mocked(AgentGenerationModel.findOne).mockResolvedValue(generation as never);
      vi.mocked(previewDatabaseOperations).mockResolvedValue({
        preview: { valid: false, operations: [], warnings: [], errors: ['conflict'], conflicts: [] },
        operationsWithDiff: [],
      });

      await expect(applyGeneration(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(applyDatabaseOperations).not.toHaveBeenCalled();
    });
  });

  describe('getProjectDatabaseSchema', () => {
    it('merges completed generations, newest first, deduplicated by model', async () => {
      vi.mocked(AgentGenerationModel.find).mockReturnValue(
        findChainable([
          { schemaContracts: [{ model: 'Todo', collection: 'todos_v2', fields: {}, indexes: [] }] },
          { schemaContracts: [{ model: 'Todo', collection: 'todos_v1', fields: {}, indexes: [] }] },
          { schemaContracts: [{ model: 'User', collection: 'users', fields: {}, indexes: [] }] },
        ]) as never
      );

      const schema = await getProjectDatabaseSchema(owner, 'p1');

      expect(schema).toHaveLength(2);
      expect(schema.find((entry) => entry.model === 'Todo')?.collection).toBe('todos_v2');
      expect(schema.find((entry) => entry.model === 'User')).toBeDefined();
    });

    it('returns an empty array when no database generation has completed', async () => {
      vi.mocked(AgentGenerationModel.find).mockReturnValue(findChainable([]) as never);
      expect(await getProjectDatabaseSchema(owner, 'p1')).toEqual([]);
    });
  });
});
