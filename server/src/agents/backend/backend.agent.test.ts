import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/backendAgent.config', () => ({
  backendAgentConfig: {
    MODEL: 'gpt-4o-mini',
    MAX_CODEGEN_RETRIES: 1,
    MAX_GENERATION_TOKENS: 4000,
    MAX_FILES_PER_OPERATION: 50,
    MAX_TASK_OPERATIONS: 100,
    MAX_TOTAL_OPERATION_SIZE: 20 * 1024 * 1024,
  },
}));

vi.mock('../../services/ai/ai.service', () => ({
  generateStructuredCompletion: vi.fn(),
}));

import * as aiService from '../../services/ai/ai.service';
import { BackendValidationError, runBackendAgent } from './backend.agent';
import { BackendAgentContext } from './backend.types';

const context: BackendAgentContext = {
  project: {
    id: 'p1',
    name: 'Test Project',
    description: 'A test project',
    frontend: 'React',
    backend: 'Express',
    database: 'MongoDB',
    authentication: 'JWT',
    styling: 'Tailwind',
    deployment: 'Railway',
  },
  manifest: null,
  task: {
    id: 'TASK-011',
    title: 'Create Todo CRUD API',
    description: 'Build Express routes/controllers/services for Todo CRUD',
    type: 'backend',
    priority: 'high',
    complexity: 'medium',
    dependencies: [],
    affectedFiles: ['server/routes/todo.routes.js'],
    acceptanceCriteria: ['POST/GET/PATCH/DELETE /api/todos work'],
  } as never,
  relevantFiles: [],
  existingPaths: [],
  apiEndpoints: [],
};

const VALID_OUTPUT = {
  operations: [
    {
      type: 'create',
      path: 'server/routes/todo.routes.js',
      content: "const router = require('express').Router(); module.exports = router;",
      reason: 'New Todo routes',
    },
  ],
  dependencyRequests: [],
  apiContracts: [{ method: 'GET', path: '/api/todos', authentication: true }],
};

describe('runBackendAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the parsed output on the first successful attempt', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: JSON.stringify(VALID_OUTPUT),
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    });

    const onStage = vi.fn();
    const result = await runBackendAgent({ context, signal: new AbortController().signal, onStage });

    expect(result.output.operations).toHaveLength(1);
    expect(result.output.apiContracts).toEqual([{ method: 'GET', path: '/api/todos', authentication: true }]);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200, totalTokens: 300 });
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(1);
    expect(onStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'generating' }));
    expect(onStage).not.toHaveBeenCalledWith(expect.objectContaining({ stage: 'retrying' }));
  });

  it('retries with a correction prompt after malformed JSON, then succeeds', async () => {
    vi.mocked(aiService.generateStructuredCompletion)
      .mockResolvedValueOnce({ content: 'not valid json', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } })
      .mockResolvedValueOnce({
        content: JSON.stringify(VALID_OUTPUT),
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      });

    const onStage = vi.fn();
    const result = await runBackendAgent({ context, signal: new AbortController().signal, onStage });

    expect(result.output.operations).toHaveLength(1);
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
    expect(onStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'retrying' }));
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 20, totalTokens: 40 });

    const secondCallArgs = vi.mocked(aiService.generateStructuredCompletion).mock.calls[1][0];
    expect(secondCallArgs.userPrompt).toContain('not valid json');
  });

  it('retries when output is structurally valid but targets a forbidden file', async () => {
    const forbiddenOutput = {
      operations: [{ type: 'update', path: '.env', content: 'SECRET=1', reason: 'x' }],
      dependencyRequests: [],
      apiContracts: [],
    };

    vi.mocked(aiService.generateStructuredCompletion)
      .mockResolvedValueOnce({ content: JSON.stringify(forbiddenOutput), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } })
      .mockResolvedValueOnce({ content: JSON.stringify(VALID_OUTPUT), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });

    const result = await runBackendAgent({ context, signal: new AbortController().signal });

    expect(result.output.operations[0].path).toBe('server/routes/todo.routes.js');
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('throws BackendValidationError once retries are exhausted', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: 'still not json',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });

    await expect(
      runBackendAgent({ context, signal: new AbortController().signal })
    ).rejects.toBeInstanceOf(BackendValidationError);

    // MAX_CODEGEN_RETRIES=1 -> 2 total attempts
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('attaches accumulated usage to a thrown BackendValidationError', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: 'still not json',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });

    try {
      await runBackendAgent({ context, signal: new AbortController().signal });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BackendValidationError);
      expect((err as BackendValidationError).usage.totalTokens).toBe(20);
    }
  });
});
