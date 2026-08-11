import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../planner/planner.service', () => ({
  generatePlan: vi.fn(),
  updatePlanStatus: vi.fn(),
}));

vi.mock('../frontend/frontend.service', () => ({
  isFrontendTask: vi.fn(),
  describeOwningAgent: vi.fn(),
  executeTask: vi.fn(),
  applyGeneration: vi.fn(),
}));

import { IPlanTask } from 'shared';
import * as frontendAgentService from '../frontend/frontend.service';
import * as plannerService from '../planner/planner.service';
import { ApiError } from '../../utils/ApiError';
import { runAutopilot } from './autopilot.service';

function task(id: string, overrides: Partial<{ title: string; dependencies: string[] }> = {}) {
  return {
    id,
    title: overrides.title ?? `Task ${id}`,
    description: '',
    type: 'frontend',
    priority: 'medium',
    complexity: 'small',
    dependencies: overrides.dependencies ?? [],
    affectedFiles: [],
    acceptanceCriteria: [],
  };
}

function plan(tasks: ReturnType<typeof task>[], executionOrder?: string[]) {
  return {
    id: 'plan-1',
    tasks,
    executionOrder,
  };
}

describe('autopilot.service', () => {
  const owner = new Types.ObjectId();
  const projectId = 'project-1';
  const signal = new AbortController().signal;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs every frontend task in executionOrder and applies each one — happy path', async () => {
    const t1 = task('T1');
    const t2 = task('T2');
    const readyPlan = plan([t1, t2], ['T1', 'T2']);

    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockReturnValue(true);
    vi.mocked(frontendAgentService.executeTask).mockImplementation(async (_o, _p, _plan, taskId) => ({
      id: `gen-${taskId}`,
    }) as never);
    vi.mocked(frontendAgentService.applyGeneration).mockResolvedValue(undefined as never);

    const result = await runAutopilot(owner, projectId, 'build it', undefined, signal);

    expect(plannerService.generatePlan).toHaveBeenCalledTimes(1);
    expect(plannerService.updatePlanStatus).toHaveBeenCalledWith(owner, projectId, 'plan-1', 'approved');
    expect(frontendAgentService.executeTask).toHaveBeenNthCalledWith(
      1,
      owner,
      projectId,
      'plan-1',
      'T1',
      signal,
      expect.any(Function)
    );
    expect(frontendAgentService.executeTask).toHaveBeenNthCalledWith(
      2,
      owner,
      projectId,
      'plan-1',
      'T2',
      signal,
      expect.any(Function)
    );
    expect(frontendAgentService.applyGeneration).toHaveBeenCalledTimes(2);
    expect(result.stoppedEarly).toBe(false);
    expect(result.tasks).toEqual([
      { taskId: 'T1', title: 'Task T1', outcome: 'completed', generationId: 'gen-T1' },
      { taskId: 'T2', title: 'Task T2', outcome: 'completed', generationId: 'gen-T2' },
    ]);
  });

  it('skips non-frontend tasks without calling executeTask, and keeps running frontend tasks', async () => {
    const frontendTask = task('T1');
    const backendTask = task('T2', { title: 'Build API' });
    const readyPlan = plan([frontendTask, backendTask], ['T1', 'T2']);

    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockImplementation((t: IPlanTask) => t.id === 'T1');
    vi.mocked(frontendAgentService.describeOwningAgent).mockReturnValue('This task belongs to the Backend Agent.');
    vi.mocked(frontendAgentService.executeTask).mockResolvedValue({ id: 'gen-T1' } as never);
    vi.mocked(frontendAgentService.applyGeneration).mockResolvedValue(undefined as never);

    const result = await runAutopilot(owner, projectId, 'build it', undefined, signal);

    expect(frontendAgentService.executeTask).toHaveBeenCalledTimes(1);
    expect(frontendAgentService.executeTask).toHaveBeenCalledWith(
      owner,
      projectId,
      'plan-1',
      'T1',
      signal,
      expect.any(Function)
    );
    expect(result.tasks).toEqual([
      { taskId: 'T1', title: 'Task T1', outcome: 'completed', generationId: 'gen-T1' },
      { taskId: 'T2', title: 'Build API', outcome: 'skipped', reason: 'This task belongs to the Backend Agent.' },
    ]);
    expect(result.stoppedEarly).toBe(false);
  });

  it('stops after a task fails and marks later tasks not_attempted, without throwing', async () => {
    const t1 = task('T1');
    const t2 = task('T2');
    const t3 = task('T3');
    const readyPlan = plan([t1, t2, t3], ['T1', 'T2', 'T3']);

    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockReturnValue(true);
    vi.mocked(frontendAgentService.executeTask).mockImplementation(async (_o, _p, _plan, taskId) => {
      if (taskId === 'T2') throw ApiError.badRequest('The Frontend Agent could not generate valid changes.');
      return { id: `gen-${taskId}` } as never;
    });
    vi.mocked(frontendAgentService.applyGeneration).mockResolvedValue(undefined as never);

    const result = await runAutopilot(owner, projectId, 'build it', undefined, signal);

    expect(frontendAgentService.executeTask).toHaveBeenCalledTimes(2);
    expect(frontendAgentService.executeTask).not.toHaveBeenCalledWith(
      owner,
      projectId,
      'plan-1',
      'T3',
      signal,
      expect.any(Function)
    );
    expect(result.stoppedEarly).toBe(true);
    expect(result.tasks).toEqual([
      { taskId: 'T1', title: 'Task T1', outcome: 'completed', generationId: 'gen-T1' },
      { taskId: 'T2', title: 'Task T2', outcome: 'failed', error: 'The Frontend Agent could not generate valid changes.' },
      { taskId: 'T3', title: 'Task T3', outcome: 'not_attempted' },
    ]);
  });

  it('falls back to plan.tasks array order when executionOrder is empty', async () => {
    const t1 = task('T1');
    const t2 = task('T2');
    const readyPlan = plan([t1, t2], []);

    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockReturnValue(true);
    vi.mocked(frontendAgentService.executeTask).mockImplementation(async (_o, _p, _plan, taskId) => ({
      id: `gen-${taskId}`,
    }) as never);
    vi.mocked(frontendAgentService.applyGeneration).mockResolvedValue(undefined as never);

    const result = await runAutopilot(owner, projectId, 'build it', undefined, signal);

    expect(result.tasks.map((r) => r.taskId)).toEqual(['T1', 'T2']);
  });

  it('ignores a stale executionOrder id that does not match any task', async () => {
    const t1 = task('T1');
    const readyPlan = plan([t1], ['ghost-id', 'T1']);

    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockReturnValue(true);
    vi.mocked(frontendAgentService.executeTask).mockResolvedValue({ id: 'gen-T1' } as never);
    vi.mocked(frontendAgentService.applyGeneration).mockResolvedValue(undefined as never);

    const result = await runAutopilot(owner, projectId, 'build it', undefined, signal);

    expect(result.tasks).toEqual([{ taskId: 'T1', title: 'Task T1', outcome: 'completed', generationId: 'gen-T1' }]);
  });

  it('propagates a plan-generation failure and never approves or runs any task', async () => {
    vi.mocked(plannerService.generatePlan).mockRejectedValue(new Error('planner exploded'));

    await expect(runAutopilot(owner, projectId, 'build it', undefined, signal)).rejects.toThrow('planner exploded');

    expect(plannerService.updatePlanStatus).not.toHaveBeenCalled();
    expect(frontendAgentService.executeTask).not.toHaveBeenCalled();
  });

  it('surfaces a frontend task blocked by a skipped dependency as a normal failed outcome', async () => {
    const backendTask = task('T1', { title: 'Build API' });
    const frontendTask = task('T2', { title: 'Wire form to API', dependencies: ['T1'] });
    const readyPlan = plan([backendTask, frontendTask], ['T1', 'T2']);

    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockImplementation((t: IPlanTask) => t.id === 'T2');
    vi.mocked(frontendAgentService.describeOwningAgent).mockReturnValue('This task belongs to the Backend Agent.');
    vi.mocked(frontendAgentService.executeTask).mockRejectedValue(
      ApiError.badRequest('Waiting for required tasks.', { dependencies: ['T1'] })
    );

    const result = await runAutopilot(owner, projectId, 'build it', undefined, signal);

    expect(result.tasks).toEqual([
      { taskId: 'T1', title: 'Build API', outcome: 'skipped', reason: 'This task belongs to the Backend Agent.' },
      { taskId: 'T2', title: 'Wire form to API', outcome: 'failed', error: 'Waiting for required tasks.' },
    ]);
    expect(result.stoppedEarly).toBe(true);
  });

  it('stops before the next task and rejects when the signal is already aborted', async () => {
    const t1 = task('T1');
    const t2 = task('T2');
    const readyPlan = plan([t1, t2], ['T1', 'T2']);

    const controller = new AbortController();
    vi.mocked(plannerService.generatePlan).mockResolvedValue(readyPlan as never);
    vi.mocked(plannerService.updatePlanStatus).mockResolvedValue(readyPlan as never);
    vi.mocked(frontendAgentService.isFrontendTask).mockReturnValue(true);
    vi.mocked(frontendAgentService.executeTask).mockImplementation(async (_o, _p, _plan, taskId) => {
      controller.abort();
      return { id: `gen-${taskId}` } as never;
    });
    vi.mocked(frontendAgentService.applyGeneration).mockResolvedValue(undefined as never);

    await expect(
      runAutopilot(owner, projectId, 'build it', undefined, controller.signal)
    ).rejects.toThrow('Autopilot run aborted');

    expect(frontendAgentService.executeTask).toHaveBeenCalledTimes(1);
  });
});
