import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AgentGenerationStatus, ProjectPlanStatus, TaskExecutionStatus, TestRunStatus } from 'shared';

vi.mock('../../config/testingAgent.config', () => ({
  testingAgentConfig: { MODEL: 'gpt-4o-mini' },
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
  TestRunModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../../services/project.service', () => ({
  getProjectById: vi.fn(),
}));

vi.mock('../../services/usage.service', () => ({
  recordUsage: vi.fn(),
}));

vi.mock('../../services/sandbox/run-registry', () => ({
  cancelRun: vi.fn(),
  registerRun: vi.fn(),
  unregisterRun: vi.fn(),
}));

vi.mock('../planner/planner.service', () => ({
  getPlan: vi.fn(),
}));

vi.mock('./testing.context', () => ({
  buildTestingContext: vi.fn().mockResolvedValue({}),
}));

vi.mock('./testing.agent', () => {
  class TestingValidationError extends Error {
    issues: string[];
    usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };

    constructor(issues: string[], usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }) {
      super(`Testing Agent output failed validation after retries: ${issues.join('; ')}`);
      this.name = 'TestingValidationError';
      this.issues = issues;
      this.usage = usage;
    }
  }

  return { runTestingAgent: vi.fn(), TestingValidationError };
});

vi.mock('./testing.operations', () => ({
  previewTestingOperations: vi.fn(),
  applyTestingOperations: vi.fn(),
}));

vi.mock('./testing.runner', () => ({
  executeTestRun: vi.fn(),
}));

vi.mock('./testing.analyzer', () => ({
  analyzeFailure: vi.fn(),
}));

vi.mock('./testing.fix', () => ({
  generateFix: vi.fn(),
}));

import { AgentGenerationModel, TaskExecutionModel, TestRunModel } from '../../models';
import * as projectService from '../../services/project.service';
import * as runRegistry from '../../services/sandbox/run-registry';
import * as usageService from '../../services/usage.service';
import * as plannerService from '../planner/planner.service';
import { previewTestingOperations } from './testing.operations';
import { TestingValidationError, runTestingAgent } from './testing.agent';
import {
  cancelTestRun,
  createTestRun,
  executeTask,
  isTestingTask,
} from './testing.service';

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

const TESTING_TASK = {
  id: 'TASK-020',
  title: 'Write Todo API tests',
  description: 'Generate Supertest tests for the Todo CRUD API',
  type: 'testing',
  priority: 'high',
  complexity: 'medium',
  dependencies: [] as string[],
  affectedFiles: ['server/tests/todo.test.js'],
  acceptanceCriteria: ['Covers create/read/update/delete and unauthorized access'],
};

const VALID_OUTPUT = {
  operations: [{ type: 'create', path: 'server/tests/todo.test.js', content: 'x', reason: 'r' }],
  dependencyRequests: [],
  testPlan: [{ name: 'Todo API', type: 'api', priority: 'high', tests: ['creates a todo'] }],
  contractWarnings: [],
};

describe('testing.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), id: 'p1' };
  const plan = {
    _id: new Types.ObjectId(),
    id: 'plan1',
    status: ProjectPlanStatus.APPROVED,
    tasks: [TESTING_TASK],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
    vi.mocked(plannerService.getPlan).mockResolvedValue(plan as never);
    vi.mocked(AgentGenerationModel.find).mockReturnValue(findChainable([]) as never);
  });

  describe('isTestingTask', () => {
    it('matches on type', () => {
      expect(isTestingTask({ ...TESTING_TASK, recommendedAgent: undefined } as never)).toBe(true);
    });

    it('matches on recommendedAgent even with a different type', () => {
      expect(isTestingTask({ ...TESTING_TASK, type: 'integration', recommendedAgent: 'testing' } as never)).toBe(true);
    });

    it('rejects a backend task', () => {
      expect(isTestingTask({ ...TESTING_TASK, type: 'backend', recommendedAgent: undefined } as never)).toBe(false);
    });
  });

  describe('executeTask', () => {
    it('rejects when the plan is not approved', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({ ...plan, status: ProjectPlanStatus.READY } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-020', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(runTestingAgent).not.toHaveBeenCalled();
    });

    it('rejects a task that does not belong to the Testing Agent', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...TESTING_TASK, type: 'backend', recommendedAgent: 'backend' }],
      } as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-020', new AbortController().signal)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Backend Agent'),
      });

      expect(runTestingAgent).not.toHaveBeenCalled();
    });

    it('blocks a task whose dependencies are not completed', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...TESTING_TASK, dependencies: ['TASK-010'] }],
      } as never);
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-020', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 400, message: 'Waiting for required tasks.' });

      expect(runTestingAgent).not.toHaveBeenCalled();
    });

    it('rejects with a conflict when the task is already running', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      const duplicateKeyError = Object.assign(new Error('duplicate'), { code: 11000 });
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockRejectedValue(duplicateKeyError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-020', new AbortController().signal)
      ).rejects.toMatchObject({ statusCode: 409, message: 'Task already running.' });

      expect(runTestingAgent).not.toHaveBeenCalled();
    });

    it('creates a preview-ready generation on success, records usage, and stores the test plan', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      vi.mocked(runTestingAgent).mockResolvedValue({
        output: VALID_OUTPUT as never,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      vi.mocked(previewTestingOperations).mockResolvedValue({
        preview: { valid: true, operations: [], warnings: [], errors: [], conflicts: [] },
        operationsWithDiff: VALID_OUTPUT.operations as never,
      });
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable(null) as never);
      vi.mocked(AgentGenerationModel.create).mockResolvedValue({ id: 'gen1', version: 1 } as never);

      const generation = await executeTask(owner, 'p1', 'plan1', 'TASK-020', new AbortController().signal);

      expect(AgentGenerationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AgentGenerationStatus.PREVIEW_READY,
          taskId: 'TASK-020',
          agentType: 'testing',
          testPlan: VALID_OUTPUT.testPlan,
          contractWarnings: [],
        })
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'testing_agent', totalTokens: 30 })
      );
      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-020' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.READY }) }
      );
      expect((generation as { id: string }).id).toBe('gen1');
    });

    it('marks the task failed and rethrows on a validation error', async () => {
      vi.mocked(TaskExecutionModel.find).mockResolvedValue([] as never);
      vi.mocked(TaskExecutionModel.findOneAndUpdate).mockResolvedValue({} as never);
      const validationError = new TestingValidationError(['bad output'], {
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
      });
      vi.mocked(runTestingAgent).mockRejectedValue(validationError);

      await expect(
        executeTask(owner, 'p1', 'plan1', 'TASK-020', new AbortController().signal)
      ).rejects.toBe(validationError);

      expect(TaskExecutionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { plan: plan._id, taskId: 'TASK-020' },
        { $set: expect.objectContaining({ status: TaskExecutionStatus.FAILED }) }
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 10 }));
    });
  });

  describe('createTestRun', () => {
    it('rejects a task that does not belong to the Testing Agent', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...plan,
        tasks: [{ ...TESTING_TASK, type: 'backend', recommendedAgent: 'backend' }],
      } as never);

      await expect(createTestRun(owner, 'p1', 'plan1', 'TASK-020', 'all')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Backend Agent'),
      });

      expect(TestRunModel.create).not.toHaveBeenCalled();
    });

    it('creates a queued TestRun row referencing the latest completed generation', async () => {
      vi.mocked(AgentGenerationModel.findOne).mockReturnValue(chainable({ _id: 'gen1' }) as never);
      vi.mocked(TestRunModel.create).mockResolvedValue({ id: 'run1', status: TestRunStatus.QUEUED } as never);

      const testRun = await createTestRun(owner, 'p1', 'plan1', 'TASK-020', 'all');

      expect(TestRunModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'TASK-020',
          status: TestRunStatus.QUEUED,
          scope: 'all',
          generationId: 'gen1',
          createdBy: owner,
        })
      );
      expect((testRun as unknown as { id: string }).id).toBe('run1');
    });
  });

  describe('cancelTestRun', () => {
    it('delegates to the sandbox run registry', () => {
      vi.mocked(runRegistry.cancelRun).mockReturnValue(true);
      expect(cancelTestRun('run1')).toBe(true);
      expect(runRegistry.cancelRun).toHaveBeenCalledWith('run1');
    });
  });
});
