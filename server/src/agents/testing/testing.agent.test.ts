import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/testingAgent.config', () => ({
  testingAgentConfig: {
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
import { TestingValidationError, runTestingAgent } from './testing.agent';
import { TestingAgentContext } from './testing.types';

const context: TestingAgentContext = {
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
    id: 'TASK-020',
    title: 'Write Todo API tests',
    description: 'Generate Supertest tests for the Todo CRUD API',
    type: 'testing',
    priority: 'high',
    complexity: 'medium',
    dependencies: [],
    affectedFiles: ['server/tests/todo.test.js'],
    acceptanceCriteria: ['Covers create/read/update/delete and unauthorized access'],
  } as never,
  relevantFiles: [],
  existingTestFiles: [],
  existingPaths: [],
  backendApiContracts: [],
  databaseSchemaContracts: [],
};

const VALID_OUTPUT = {
  operations: [
    {
      type: 'create',
      path: 'server/tests/todo.test.js',
      content: "const request = require('supertest'); describe('Todo API', () => { it('creates a todo', async () => {}); });",
      reason: 'API tests for Todo CRUD',
    },
  ],
  dependencyRequests: [],
  testPlan: [{ name: 'Todo API', type: 'api', priority: 'high', tests: ['creates a todo'] }],
  contractWarnings: [],
};

describe('runTestingAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the parsed output on the first successful attempt', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: JSON.stringify(VALID_OUTPUT),
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    });

    const onStage = vi.fn();
    const result = await runTestingAgent({ context, signal: new AbortController().signal, onStage });

    expect(result.output.operations).toHaveLength(1);
    expect(result.output.testPlan[0].name).toBe('Todo API');
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
    const result = await runTestingAgent({ context, signal: new AbortController().signal, onStage });

    expect(result.output.operations).toHaveLength(1);
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
    expect(onStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'retrying' }));

    const secondCallArgs = vi.mocked(aiService.generateStructuredCompletion).mock.calls[1][0];
    expect(secondCallArgs.userPrompt).toContain('not valid json');
  });

  it('retries when output is structurally valid but contains a secret', async () => {
    const secretOutput = {
      operations: [{ type: 'create', path: 'server/tests/todo.test.js', content: 'const key = "AKIAABCDEFGHIJKLMNOP";', reason: 'x' }],
      dependencyRequests: [],
      testPlan: [],
      contractWarnings: [],
    };

    vi.mocked(aiService.generateStructuredCompletion)
      .mockResolvedValueOnce({ content: JSON.stringify(secretOutput), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } })
      .mockResolvedValueOnce({ content: JSON.stringify(VALID_OUTPUT), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });

    const result = await runTestingAgent({ context, signal: new AbortController().signal });

    expect(result.output.operations[0].path).toBe('server/tests/todo.test.js');
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('throws TestingValidationError once retries are exhausted', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: 'still not json',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });

    await expect(runTestingAgent({ context, signal: new AbortController().signal })).rejects.toBeInstanceOf(
      TestingValidationError
    );

    // MAX_CODEGEN_RETRIES=1 -> 2 total attempts
    expect(aiService.generateStructuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('attaches accumulated usage to a thrown TestingValidationError', async () => {
    vi.mocked(aiService.generateStructuredCompletion).mockResolvedValue({
      content: 'still not json',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });

    try {
      await runTestingAgent({ context, signal: new AbortController().signal });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TestingValidationError);
      expect((err as TestingValidationError).usage.totalTokens).toBe(20);
    }
  });
});
