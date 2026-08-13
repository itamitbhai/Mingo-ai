import { testingAgentConfig } from '../../config/testingAgent.config';
import * as aiService from '../../services/ai/ai.service';
import { TokenUsage } from '../../services/ai/ai.types';
import { logger } from '../../utils/logger';
import { buildTestingCorrectionPrompt, buildTestingSystemPrompt, buildTestingUserPrompt } from './testing.prompts';
import { TestingOutput } from './testing.schema';
import { OnTestingStage, TestingAgentContext, TestingStage } from './testing.types';
import { parseTestingOutput, validateOperationSemantics } from './testing.validator';

export class TestingValidationError extends Error {
  public readonly issues: string[];
  public readonly usage: TokenUsage;

  constructor(issues: string[], usage: TokenUsage) {
    super(`Testing Agent output failed validation after retries: ${issues.join('; ')}`);
    this.name = 'TestingValidationError';
    this.issues = issues;
    this.usage = usage;
  }
}

export interface RunTestingAgentParams {
  context: TestingAgentContext;
  signal: AbortSignal;
  onStage?: OnTestingStage;
}

export interface RunTestingAgentResult {
  output: TestingOutput;
  usage: TokenUsage;
}

function emit(onStage: OnTestingStage | undefined, stage: TestingStage, label: string, attempt?: number) {
  onStage?.({ stage, label, attempt });
}

function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    inputTokens: (total.inputTokens ?? 0) + (next.inputTokens ?? 0),
    outputTokens: (total.outputTokens ?? 0) + (next.outputTokens ?? 0),
    totalTokens: (total.totalTokens ?? 0) + (next.totalTokens ?? 0),
  };
}

/**
 * The Testing Agent: task + project + backend/database-contract context → validated structured test
 * file operations + a test plan. Pure orchestration over `ai.service` — never touches MongoDB, the
 * filesystem, or a child process directly, mirroring `database.agent.ts`'s `runDatabaseAgent` exactly.
 * Retries with a correction prompt (bounded by `MAX_CODEGEN_RETRIES`) whenever the model's output
 * fails JSON parsing, Zod validation, or the semantic/secret-scan checks.
 */
export async function runTestingAgent({
  context,
  signal,
  onStage,
}: RunTestingAgentParams): Promise<RunTestingAgentResult> {
  const systemPrompt = buildTestingSystemPrompt(context);
  let userPrompt = buildTestingUserPrompt(context);

  const maxAttempts = testingAgentConfig.MAX_CODEGEN_RETRIES + 1;
  let lastRaw = '';
  let lastIssues: string[] = [];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit(onStage, 'generating', 'Generating test files…', attempt);
    logger.info('testing_agent.attempt.started', { attempt, maxAttempts });

    const result = await aiService.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      signal,
      model: testingAgentConfig.MODEL,
      maxOutputTokens: testingAgentConfig.MAX_GENERATION_TOKENS,
    });
    lastRaw = result.content;
    usage = addUsage(usage, result.usage);

    emit(onStage, 'validating', 'Validating generated tests…', attempt);

    const parsed = parseTestingOutput(lastRaw);

    if (parsed.success) {
      const semanticIssues = validateOperationSemantics(parsed.data);
      if (semanticIssues.length === 0) {
        logger.info('testing_agent.attempt.succeeded', { attempt });
        return { output: parsed.data, usage };
      }
      lastIssues = semanticIssues;
    } else {
      lastIssues = parsed.issues;
    }

    logger.warn('testing_agent.validationFailed', { attempt, issues: lastIssues });

    if (attempt < maxAttempts) {
      logger.info('testing_agent.retry', { attempt: attempt + 1, maxAttempts });
      emit(onStage, 'retrying', `Fixing issues (attempt ${attempt + 1} of ${maxAttempts})…`, attempt + 1);
      userPrompt = buildTestingCorrectionPrompt(lastRaw, lastIssues);
    }
  }

  throw new TestingValidationError(lastIssues, usage);
}
