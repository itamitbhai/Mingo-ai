import { databaseAgentConfig } from '../../config/databaseAgent.config';
import * as aiService from '../../services/ai/ai.service';
import { TokenUsage } from '../../services/ai/ai.types';
import { logger } from '../../utils/logger';
import {
  buildDatabaseCorrectionPrompt,
  buildDatabaseSystemPrompt,
  buildDatabaseUserPrompt,
} from './database.prompts';
import { DatabaseOutput } from './database.schema';
import { DatabaseAgentContext, DatabaseStage, OnDatabaseStage } from './database.types';
import { parseDatabaseOutput, validateOperationSemantics } from './database.validator';

export class DatabaseValidationError extends Error {
  public readonly issues: string[];
  public readonly usage: TokenUsage;

  constructor(issues: string[], usage: TokenUsage) {
    super(`Database Agent output failed validation after retries: ${issues.join('; ')}`);
    this.name = 'DatabaseValidationError';
    this.issues = issues;
    this.usage = usage;
  }
}

export interface RunDatabaseAgentParams {
  context: DatabaseAgentContext;
  signal: AbortSignal;
  onStage?: OnDatabaseStage;
}

export interface RunDatabaseAgentResult {
  output: DatabaseOutput;
  usage: TokenUsage;
}

function emit(onStage: OnDatabaseStage | undefined, stage: DatabaseStage, label: string, attempt?: number) {
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
 * The Database Agent: task + project + backend-contract context → validated structured file
 * operations + schema metadata. Pure orchestration over `ai.service` — never touches MongoDB or the
 * filesystem directly, mirroring `backend.agent.ts`'s `runBackendAgent` exactly. Retries with a
 * correction prompt (bounded by `MAX_CODEGEN_RETRIES`) whenever the model's output fails JSON
 * parsing, Zod validation, or the semantic/security checks.
 */
export async function runDatabaseAgent({
  context,
  signal,
  onStage,
}: RunDatabaseAgentParams): Promise<RunDatabaseAgentResult> {
  const systemPrompt = buildDatabaseSystemPrompt(context);
  let userPrompt = buildDatabaseUserPrompt(context);

  const maxAttempts = databaseAgentConfig.MAX_CODEGEN_RETRIES + 1;
  let lastRaw = '';
  let lastIssues: string[] = [];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit(onStage, 'generating', 'Generating Mongoose schema and model…', attempt);
    logger.info('database_agent.attempt.started', { attempt, maxAttempts });

    const result = await aiService.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      signal,
      model: databaseAgentConfig.MODEL,
      maxOutputTokens: databaseAgentConfig.MAX_GENERATION_TOKENS,
    });
    lastRaw = result.content;
    usage = addUsage(usage, result.usage);

    emit(onStage, 'validating', 'Validating generated schema…', attempt);

    const parsed = parseDatabaseOutput(lastRaw);

    if (parsed.success) {
      const semanticIssues = validateOperationSemantics(parsed.data);
      if (semanticIssues.length === 0) {
        logger.info('database_agent.attempt.succeeded', { attempt });
        return { output: parsed.data, usage };
      }
      lastIssues = semanticIssues;
    } else {
      lastIssues = parsed.issues;
    }

    logger.warn('database_agent.validationFailed', { attempt, issues: lastIssues });

    if (attempt < maxAttempts) {
      logger.info('database_agent.retry', { attempt: attempt + 1, maxAttempts });
      emit(onStage, 'retrying', `Fixing issues (attempt ${attempt + 1} of ${maxAttempts})…`, attempt + 1);
      userPrompt = buildDatabaseCorrectionPrompt(lastRaw, lastIssues);
    }
  }

  throw new DatabaseValidationError(lastIssues, usage);
}
