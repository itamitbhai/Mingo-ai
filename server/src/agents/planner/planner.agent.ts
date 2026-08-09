import { env } from '../../config/env';
import * as aiService from '../../services/ai/ai.service';
import { TokenUsage } from '../../services/ai/ai.types';
import { logger } from '../../utils/logger';
import { buildCorrectionPrompt, buildPlannerSystemPrompt, buildPlannerUserPrompt } from './planner.prompts';
import { PlannerOutput } from './planner.schema';
import { OnPlannerStage, PlannerContext, PlannerStage } from './planner.types';
import { parsePlannerOutput, validatePlanSemantics } from './planner.validator';

export class PlannerValidationError extends Error {
  public readonly issues: string[];
  public readonly usage: TokenUsage;

  constructor(issues: string[], usage: TokenUsage) {
    super(`Planner output failed validation after retries: ${issues.join('; ')}`);
    this.name = 'PlannerValidationError';
    this.issues = issues;
    this.usage = usage;
  }
}

export interface RunPlannerAgentParams {
  context: PlannerContext;
  prompt: string;
  signal: AbortSignal;
  onStage?: OnPlannerStage;
}

export interface RunPlannerAgentResult {
  output: PlannerOutput;
  usage: TokenUsage;
}

function emit(onStage: OnPlannerStage | undefined, stage: PlannerStage, label: string, attempt?: number) {
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
 * The Planner Agent: natural language → validated structured plan. Pure orchestration over
 * `ai.service` — never touches MongoDB or the filesystem (spec §5). Retries with a correction
 * prompt (bounded by `MAX_PLANNER_RETRIES`) whenever the model's output fails JSON parsing, Zod
 * validation, or the semantic checks (duplicate/unknown task ids, circular dependencies, an
 * execution order inconsistent with them).
 */
export async function runPlannerAgent({
  context,
  prompt,
  signal,
  onStage,
}: RunPlannerAgentParams): Promise<RunPlannerAgentResult> {
  const systemPrompt = buildPlannerSystemPrompt(context);
  let userPrompt = buildPlannerUserPrompt(prompt, context);

  const maxAttempts = env.MAX_PLANNER_RETRIES + 1;
  let lastRaw = '';
  let lastIssues: string[] = [];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit(onStage, 'generating', 'Generating the plan…', attempt);
    logger.info('planner.attempt.started', { attempt, maxAttempts });

    const result = await aiService.generateStructuredCompletion({ systemPrompt, userPrompt, signal });
    lastRaw = result.content;
    usage = addUsage(usage, result.usage);

    emit(onStage, 'validating', 'Validating the plan…', attempt);

    const parsed = parsePlannerOutput(lastRaw);

    if (parsed.success) {
      const semanticIssues = validatePlanSemantics(parsed.data);
      if (semanticIssues.length === 0) {
        logger.info('planner.attempt.succeeded', { attempt });
        return { output: parsed.data, usage };
      }
      lastIssues = semanticIssues;
    } else {
      lastIssues = parsed.issues;
    }

    logger.warn('planner.validationFailed', { attempt, issues: lastIssues });

    if (attempt < maxAttempts) {
      logger.info('planner.retry', { attempt: attempt + 1, maxAttempts });
      emit(onStage, 'retrying', `Fixing plan issues (attempt ${attempt + 1} of ${maxAttempts})…`, attempt + 1);
      userPrompt = buildCorrectionPrompt(lastRaw, lastIssues);
    }
  }

  throw new PlannerValidationError(lastIssues, usage);
}
