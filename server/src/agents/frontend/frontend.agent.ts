import { frontendAgentConfig } from '../../config/frontendAgent.config';
import * as aiService from '../../services/ai/ai.service';
import { TokenUsage } from '../../services/ai/ai.types';
import { logger } from '../../utils/logger';
import {
  buildFrontendCorrectionPrompt,
  buildFrontendSystemPrompt,
  buildFrontendUserPrompt,
} from './frontend.prompts';
import { FrontendOutput } from './frontend.schema';
import { FrontendAgentContext, FrontendStage, OnFrontendStage } from './frontend.types';
import { parseFrontendOutput, validateOperationSemantics } from './frontend.validator';

export class FrontendValidationError extends Error {
  public readonly issues: string[];
  public readonly usage: TokenUsage;

  constructor(issues: string[], usage: TokenUsage) {
    super(`Frontend Agent output failed validation after retries: ${issues.join('; ')}`);
    this.name = 'FrontendValidationError';
    this.issues = issues;
    this.usage = usage;
  }
}

export interface RunFrontendAgentParams {
  context: FrontendAgentContext;
  signal: AbortSignal;
  onStage?: OnFrontendStage;
}

export interface RunFrontendAgentResult {
  output: FrontendOutput;
  usage: TokenUsage;
}

function emit(onStage: OnFrontendStage | undefined, stage: FrontendStage, label: string, attempt?: number) {
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
 * The Frontend Agent: task + project context → validated structured file operations. Pure
 * orchestration over `ai.service` — never touches MongoDB or the filesystem directly, mirroring
 * `planner.agent.ts`'s `runPlannerAgent`. Retries with a correction prompt (bounded by
 * `MAX_CODEGEN_RETRIES`) whenever the model's output fails JSON parsing, Zod validation, or the
 * semantic/security checks (duplicate paths, forbidden files, size/count limits).
 */
export async function runFrontendAgent({
  context,
  signal,
  onStage,
}: RunFrontendAgentParams): Promise<RunFrontendAgentResult> {
  const systemPrompt = buildFrontendSystemPrompt(context);
  let userPrompt = buildFrontendUserPrompt(context);

  const maxAttempts = frontendAgentConfig.MAX_CODEGEN_RETRIES + 1;
  let lastRaw = '';
  let lastIssues: string[] = [];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit(onStage, 'generating', 'Generating code…', attempt);
    logger.info('frontend_agent.attempt.started', { attempt, maxAttempts });

    const result = await aiService.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      signal,
      model: frontendAgentConfig.MODEL,
      maxOutputTokens: frontendAgentConfig.MAX_GENERATION_TOKENS,
    });
    lastRaw = result.content;
    usage = addUsage(usage, result.usage);

    emit(onStage, 'validating', 'Validating generated changes…', attempt);

    const parsed = parseFrontendOutput(lastRaw);

    if (parsed.success) {
      const semanticIssues = validateOperationSemantics(parsed.data);
      if (semanticIssues.length === 0) {
        logger.info('frontend_agent.attempt.succeeded', { attempt });
        return { output: parsed.data, usage };
      }
      lastIssues = semanticIssues;
    } else {
      lastIssues = parsed.issues;
    }

    logger.warn('frontend_agent.validationFailed', { attempt, issues: lastIssues });

    if (attempt < maxAttempts) {
      logger.info('frontend_agent.retry', { attempt: attempt + 1, maxAttempts });
      emit(onStage, 'retrying', `Fixing issues (attempt ${attempt + 1} of ${maxAttempts})…`, attempt + 1);
      userPrompt = buildFrontendCorrectionPrompt(lastRaw, lastIssues);
    }
  }

  throw new FrontendValidationError(lastIssues, usage);
}
