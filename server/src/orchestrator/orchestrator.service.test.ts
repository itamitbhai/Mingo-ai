import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { ProjectPlanStatus, WorkflowMode, WorkflowStatus, WorkflowTaskStatus } from 'shared';

vi.mock('../config/orchestrator.config', () => ({
  orchestratorConfig: { MAX_CONCURRENT_AGENTS: 3, MAX_RETRIES: 2, MAX_FIX_CYCLES: 3, MAX_EVENTS: 200 },
}));

vi.mock('../models', () => ({
  WorkflowModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../services/project.service', () => ({
  getProjectById: vi.fn(),
}));

vi.mock('../agents/planner/planner.service', () => ({
  getPlan: vi.fn(),
  generatePlan: vi.fn(),
  updatePlanStatus: vi.fn(),
}));

// `getAgentIdForTask`/`isOrchestrable` pull in all four real agent service modules (and therefore
// `config/env`) — mocked here so this test never loads that graph, mirroring how
// `frontend.service.test.ts` mocks `isBackendTask`/`isDatabaseTask`/`isTestingTask` for the same reason.
vi.mock('./agent-registry', () => ({
  getAgentIdForTask: vi.fn().mockReturnValue('frontend'),
  isOrchestrable: vi.fn().mockReturnValue(true),
}));

// The actual run loop is a large, stateful thing tested indirectly through its effect
// (`runWorkflow` being invoked) — never actually executed inside these tests.
vi.mock('./orchestrator', () => ({
  runWorkflow: vi.fn().mockResolvedValue(undefined),
  isWorkflowActive: vi.fn().mockReturnValue(false),
  requestPause: vi.fn().mockReturnValue(true),
  requestResumeFlag: vi.fn().mockReturnValue(true),
  requestCancel: vi.fn().mockReturnValue(true),
}));

import { WorkflowModel } from '../models';
import * as projectService from '../services/project.service';
import * as plannerService from '../agents/planner/planner.service';
import { isOrchestrable } from './agent-registry';
import * as runtime from './orchestrator';
import {
  cancelWorkflow,
  createWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  retryTask,
} from './orchestrator.service';

const TASK_A = {
  id: 'TASK-A',
  title: 'Frontend UI',
  description: 'x',
  type: 'frontend',
  priority: 'high',
  complexity: 'small',
  dependencies: [] as string[],
  affectedFiles: [],
  acceptanceCriteria: [],
};

const TASK_B = { ...TASK_A, id: 'TASK-B', dependencies: ['TASK-A'] };

describe('orchestrator.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), id: 'p1' };
  const approvedPlan = {
    _id: new Types.ObjectId(),
    id: 'plan1',
    status: ProjectPlanStatus.APPROVED,
    tasks: [TASK_A, TASK_B],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
    vi.mocked(isOrchestrable).mockReturnValue(true);
  });

  describe('createWorkflow', () => {
    it('rejects when neither prompt nor planId is given', async () => {
      await expect(
        createWorkflow({ owner, projectId: 'p1', mode: WorkflowMode.REVIEW, signal: new AbortController().signal })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects a planId pointing at an unapproved plan', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({ ...approvedPlan, status: ProjectPlanStatus.READY } as never);

      await expect(
        createWorkflow({
          owner,
          projectId: 'p1',
          planId: 'plan1',
          mode: WorkflowMode.REVIEW,
          signal: new AbortController().signal,
        })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('approve it first') });
    });

    it('rejects a plan with no tasks', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({ ...approvedPlan, tasks: [] } as never);

      await expect(
        createWorkflow({
          owner,
          projectId: 'p1',
          planId: 'plan1',
          mode: WorkflowMode.REVIEW,
          signal: new AbortController().signal,
        })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('no tasks') });
    });

    it('rejects a plan whose tasks form a circular dependency', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue({
        ...approvedPlan,
        tasks: [
          { ...TASK_A, dependencies: ['TASK-B'] },
          { ...TASK_B, dependencies: ['TASK-A'] },
        ],
      } as never);

      await expect(
        createWorkflow({
          owner,
          projectId: 'p1',
          planId: 'plan1',
          mode: WorkflowMode.REVIEW,
          signal: new AbortController().signal,
        })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('circular') });

      expect(WorkflowModel.create).not.toHaveBeenCalled();
    });

    it('creates a queued workflow with one task-state entry per plan task and starts it in the background', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue(approvedPlan as never);
      vi.mocked(WorkflowModel.create).mockResolvedValue({ id: 'wf1', tasks: [] } as never);

      const workflow = await createWorkflow({
        owner,
        projectId: 'p1',
        planId: 'plan1',
        mode: WorkflowMode.AUTO,
        signal: new AbortController().signal,
      });

      expect(WorkflowModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WorkflowStatus.QUEUED,
          mode: WorkflowMode.AUTO,
          tasks: [
            expect.objectContaining({ taskId: 'TASK-A', status: WorkflowTaskStatus.PENDING }),
            expect.objectContaining({ taskId: 'TASK-B', status: WorkflowTaskStatus.PENDING }),
          ],
        })
      );
      expect(runtime.runWorkflow).toHaveBeenCalledWith('wf1', owner, 'p1');
      expect((workflow as unknown as { id: string }).id).toBe('wf1');
    });

    it('marks a non-orchestrable task as skipped from the start rather than pending', async () => {
      vi.mocked(plannerService.getPlan).mockResolvedValue(approvedPlan as never);
      vi.mocked(isOrchestrable).mockImplementation((task: { id: string }) => task.id !== 'TASK-B');
      vi.mocked(WorkflowModel.create).mockResolvedValue({ id: 'wf1', tasks: [] } as never);

      await createWorkflow({
        owner,
        projectId: 'p1',
        planId: 'plan1',
        mode: WorkflowMode.REVIEW,
        signal: new AbortController().signal,
      });

      expect(WorkflowModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tasks: [
            expect.objectContaining({ taskId: 'TASK-A', status: WorkflowTaskStatus.PENDING }),
            expect.objectContaining({ taskId: 'TASK-B', status: WorkflowTaskStatus.SKIPPED }),
          ],
        })
      );
    });

    it('generates and auto-approves a plan first when given a prompt instead of a planId', async () => {
      vi.mocked(plannerService.generatePlan).mockResolvedValue({ id: 'plan1' } as never);
      vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(approvedPlan as never);
      vi.mocked(WorkflowModel.create).mockResolvedValue({ id: 'wf1', tasks: [] } as never);

      await createWorkflow({
        owner,
        projectId: 'p1',
        prompt: 'Build a todo app',
        mode: WorkflowMode.REVIEW,
        signal: new AbortController().signal,
      });

      expect(plannerService.generatePlan).toHaveBeenCalled();
      expect(plannerService.updatePlanStatus).toHaveBeenCalledWith(owner, 'p1', 'plan1', 'approved');
      expect(WorkflowModel.create).toHaveBeenCalled();
    });
  });

  describe('pauseWorkflow', () => {
    it('rejects when the workflow is not currently running', async () => {
      vi.mocked(WorkflowModel.findOne).mockResolvedValue({ id: 'wf1', status: WorkflowStatus.RUNNING } as never);
      vi.mocked(runtime.requestPause).mockReturnValue(false);

      await expect(pauseWorkflow(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('requests a pause on the active run', async () => {
      const workflowId = new Types.ObjectId().toString();
      vi.mocked(WorkflowModel.findOne).mockResolvedValue({ id: workflowId, status: WorkflowStatus.RUNNING } as never);
      vi.mocked(runtime.requestPause).mockReturnValue(true);

      await pauseWorkflow(owner, 'p1', workflowId);
      expect(runtime.requestPause).toHaveBeenCalledWith(workflowId);
    });
  });

  describe('resumeWorkflow', () => {
    it('rejects resuming an already-completed workflow', async () => {
      vi.mocked(WorkflowModel.findOne).mockResolvedValue({ id: 'wf1', status: WorkflowStatus.COMPLETED } as never);

      await expect(resumeWorkflow(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('just lifts the pause flag when the run is still alive in-memory', async () => {
      const workflowId = new Types.ObjectId().toString();
      vi.mocked(WorkflowModel.findOne).mockResolvedValue({ id: workflowId, status: WorkflowStatus.PAUSED } as never);
      vi.mocked(runtime.isWorkflowActive).mockReturnValue(true);

      await resumeWorkflow(owner, 'p1', workflowId);

      expect(runtime.requestResumeFlag).toHaveBeenCalledWith(workflowId);
      expect(runtime.runWorkflow).not.toHaveBeenCalled();
    });

    it('starts a fresh detached run when nothing is active in-memory (e.g. after a restart)', async () => {
      const workflowId = new Types.ObjectId().toString();
      const workflowDoc = { id: workflowId, status: WorkflowStatus.WAITING_FOR_APPROVAL, save: vi.fn() };
      vi.mocked(WorkflowModel.findOne).mockResolvedValue(workflowDoc as never);
      vi.mocked(runtime.isWorkflowActive).mockReturnValue(false);

      await resumeWorkflow(owner, 'p1', workflowId);

      expect(workflowDoc.save).toHaveBeenCalled();
      expect(workflowDoc.status).toBe(WorkflowStatus.RUNNING);
      expect(runtime.runWorkflow).toHaveBeenCalledWith(workflowId, owner, 'p1');
    });
  });

  describe('cancelWorkflow', () => {
    it('requests cancellation on an active run without directly mutating status', async () => {
      const workflowId = new Types.ObjectId().toString();
      const workflowDoc = { id: workflowId, status: WorkflowStatus.RUNNING, save: vi.fn() };
      vi.mocked(WorkflowModel.findOne).mockResolvedValue(workflowDoc as never);
      vi.mocked(runtime.requestCancel).mockReturnValue(true);

      await cancelWorkflow(owner, 'p1', workflowId);

      expect(runtime.requestCancel).toHaveBeenCalledWith(workflowId);
      expect(workflowDoc.save).not.toHaveBeenCalled();
    });

    it('directly marks it cancelled when nothing is actively running', async () => {
      const workflowId = new Types.ObjectId().toString();
      const workflowDoc = { id: workflowId, status: WorkflowStatus.WAITING_FOR_APPROVAL, save: vi.fn() };
      vi.mocked(WorkflowModel.findOne).mockResolvedValue(workflowDoc as never);
      vi.mocked(runtime.requestCancel).mockReturnValue(false);

      await cancelWorkflow(owner, 'p1', workflowId);

      expect(workflowDoc.status).toBe(WorkflowStatus.CANCELLED);
      expect(workflowDoc.save).toHaveBeenCalled();
    });
  });

  describe('retryTask', () => {
    it('rejects retrying a task that is not in a failed state', async () => {
      const workflowDoc = {
        id: 'wf1',
        status: WorkflowStatus.RUNNING,
        tasks: [{ taskId: 'TASK-A', status: WorkflowTaskStatus.COMPLETED }],
        markModified: vi.fn(),
        save: vi.fn(),
      };
      vi.mocked(WorkflowModel.findOne).mockResolvedValue(workflowDoc as never);

      await expect(retryTask(owner, 'p1', new Types.ObjectId().toString(), 'TASK-A')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('resets a failed task back to ready and restarts the run if not already active', async () => {
      const workflowId = new Types.ObjectId().toString();
      const taskState = { taskId: 'TASK-A', status: WorkflowTaskStatus.FAILED, error: 'boom', failureCategory: 'RUNTIME_ERROR' };
      const workflowDoc = {
        id: workflowId,
        status: WorkflowStatus.FAILED,
        tasks: [taskState],
        markModified: vi.fn(),
        save: vi.fn(),
      };
      vi.mocked(WorkflowModel.findOne).mockResolvedValue(workflowDoc as never);
      vi.mocked(runtime.isWorkflowActive).mockReturnValue(false);

      await retryTask(owner, 'p1', workflowId, 'TASK-A');

      expect(taskState.status).toBe(WorkflowTaskStatus.READY);
      expect(taskState.error).toBeUndefined();
      expect(workflowDoc.save).toHaveBeenCalled();
      expect(runtime.runWorkflow).toHaveBeenCalledWith(workflowId, owner, 'p1');
    });
  });
});
