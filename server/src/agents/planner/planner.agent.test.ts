import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  env: { AI_MODEL: 'gpt-4o-mini', MAX_PLANNER_RETRIES: 1 },
}));

vi.mock('../../services/ai/ai.service', () => ({
  generateStructuredCompletion: vi.fn(),
}));

import * as aiService from '../../services/ai/ai.service';
import { PlannerValidationError, runPlannerAgent } from './planner.agent';
import { PlannerContext } from './planner.types';

const context: PlannerContext = {
  project: {
    id: 'p1',
    name: 'Test Project',
    description: 'A test project',
    frontend: 'React',
    backend: 'Express',
    database: 'MongoDB',
    authentication: 'Clerk',
    styling: 'Tailwind',
    deployment: 'Vercel',
  },
  workspace: null,
  manifest: null,
  files: [],
  dependencies: {},
  recentChanges: [],
  conversation: [],
};

const VALID_PLAN = {
  summary: 'A todo app',
  projectType: 'Productivity',
  requirements: { explicit: ['Use React'], inferred: [], missing: [] },
  stack: { frontend: { name: 'React', source: 'user_selected' } },
  architecture: { description: '', nodes: [], edges: [] },
  features: [],
  database: { entities: [], relationships: [] },
  api: [],
  frontend: { pages: [], components: [], hooks: [], state: [] },
  files: [],
  tasks: [
    {
      id: 'TASK-001',
      title: 'Set up project',
      description: 'Initialize the repo',
      type: 'setup',
      priority: 'high',
      complexity: 'small',
      dependencies: [],
      affectedFiles: [],
      acceptanceCriteria: ['Project builds successfully'],
    },
  ],
  executionOrder: ['TASK-001'],
  risks: [],
  assumptions: [],
  security: [],
  nonFunctionalRequirements: [],
  conflicts: [],
};

describe('runPlannerAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the parsed output on the first successful attempt', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: JSON.stringify(VALID_PLAN),
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    });

    const onStage = vi.fn();
    const result = await runPlannerAgent({
      context,
      prompt: 'Build a todo app',
      signal: new AbortController().signal,
      onStage,
    });

    expect(result.output.summary).toBe('A todo app');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200, totalTokens: 300 });
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(1);
    expect(onStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'generating' }));
    expect(onStage).not.toHaveBeenCalledWith(expect.objectContaining({ stage: 'retrying' }));
  });

  it('retries with a correction prompt after malformed JSON, then succeeds', async () => {
    vi.mocked(aiService.generateStructuredCompletion)
      .mockResolvedValueOnce({
        content: 'not valid json',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(VALID_PLAN),
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      });

    const onStage = vi.fn();
    const result = await runPlannerAgent({
      context,
      prompt: 'Build a todo app',
      signal: new AbortController().signal,
      onStage,
    });

    expect(result.output.summary).toBe('A todo app');
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
    expect(onStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'retrying' }));

    // usage accumulates across attempts
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 20, totalTokens: 40 });

    // the correction prompt (second call) must include the previous invalid output
    const secondCallArgs = vi.mocked(aiService.generateStructuredCompletion).mock.calls[1][0];
    expect(secondCallArgs.userPrompt).toContain('not valid json');
  });

  it('retries when the plan is structurally valid but has a circular task dependency', async () => {
    const circularPlan = {
      ...VALID_PLAN,
      tasks: [
        { ...VALID_PLAN.tasks[0], id: 'TASK-001', dependencies: ['TASK-002'] },
        { ...VALID_PLAN.tasks[0], id: 'TASK-002', dependencies: ['TASK-001'] },
      ],
      executionOrder: ['TASK-001', 'TASK-002'],
    };

    vi.mocked(aiService.generateStructuredCompletion)
      .mockResolvedValueOnce({
        content: JSON.stringify(circularPlan),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(VALID_PLAN),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });

    const result = await runPlannerAgent({
      context,
      prompt: 'Build a todo app',
      signal: new AbortController().signal,
    });

    expect(result.output.tasks).toHaveLength(1);
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('throws PlannerValidationError once retries are exhausted', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: 'still not json',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });

    await expect(
      runPlannerAgent({ context, prompt: 'Build a todo app', signal: new AbortController().signal })
    ).rejects.toBeInstanceOf(PlannerValidationError);

    // MAX_PLANNER_RETRIES=1 -> 2 total attempts
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('attaches accumulated usage to a thrown PlannerValidationError', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: 'still not json',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });

    try {
      await runPlannerAgent({ context, prompt: 'Build a todo app', signal: new AbortController().signal });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PlannerValidationError);
      expect((err as PlannerValidationError).usage.totalTokens).toBe(20);
    }
  });
});
