import { backendAgentConfig } from '../../config/backendAgent.config';
import * as aiService from '../../services/ai/ai.service';
import { TokenUsage } from '../../services/ai/ai.types';
import { logger } from '../../utils/logger';
import {
  buildBackendCorrectionPrompt,
  buildBackendSystemPrompt,
  buildBackendUserPrompt,
} from './backend.prompts';
import { BackendOutput } from './backend.schema';
import { BackendAgentContext, BackendStage, OnBackendStage } from './backend.types';
import { parseBackendOutput, validateOperationSemantics } from './backend.validator';

export class BackendValidationError extends Error {
  public readonly issues: string[];
  public readonly usage: TokenUsage;

  constructor(issues: string[], usage: TokenUsage) {
    super(`Backend Agent output failed validation after retries: ${issues.join('; ')}`);
    this.name = 'BackendValidationError';
    this.issues = issues;
    this.usage = usage;
  }
}

export interface RunBackendAgentParams {
  context: BackendAgentContext;
  signal: AbortSignal;
  onStage?: OnBackendStage;
}

export interface RunBackendAgentResult {
  output: BackendOutput;
  usage: TokenUsage;
}

function emit(onStage: OnBackendStage | undefined, stage: BackendStage, label: string, attempt?: number) {
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
 * The Backend Agent: task + project context → validated structured file operations. Pure
 * orchestration over `ai.service` — never touches MongoDB or the filesystem directly, mirroring
 * `frontend.agent.ts`'s `runFrontendAgent` exactly. Retries with a correction prompt (bounded by
 * `MAX_CODEGEN_RETRIES`) whenever the model's output fails JSON parsing, Zod validation, or the
 * semantic/security checks (duplicate paths, forbidden files, size/count limits).
 */
export async function runBackendAgent({
  context,
  signal,
  onStage,
}: RunBackendAgentParams): Promise<RunBackendAgentResult> {
  const systemPrompt = buildBackendSystemPrompt(context);
  let userPrompt = buildBackendUserPrompt(context);

  const maxAttempts = backendAgentConfig.MAX_CODEGEN_RETRIES + 1;
  let lastRaw = '';
  let lastIssues: string[] = [];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit(onStage, 'generating', 'Generating backend code…', attempt);
    logger.info('backend_agent.attempt.started', { attempt, maxAttempts });

    const result = await aiService.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      signal,
      model: backendAgentConfig.MODEL,
      maxOutputTokens: backendAgentConfig.MAX_GENERATION_TOKENS,
    });
    lastRaw = result.content;
    usage = addUsage(usage, result.usage);

    emit(onStage, 'validating', 'Validating generated changes…', attempt);

    const parsed = parseBackendOutput(lastRaw);

    if (parsed.success) {
      const semanticIssues = validateOperationSemantics(parsed.data);
      if (semanticIssues.length === 0) {
        logger.info('backend_agent.attempt.succeeded', { attempt });
        return { output: parsed.data, usage };
      }
      lastIssues = semanticIssues;
    } else {
      lastIssues = parsed.issues;
    }

    logger.warn('backend_agent.validationFailed', { attempt, issues: lastIssues });

    if (attempt < maxAttempts) {
      logger.info('backend_agent.retry', { attempt: attempt + 1, maxAttempts });
      emit(onStage, 'retrying', `Fixing issues (attempt ${attempt + 1} of ${maxAttempts})…`, attempt + 1);
      userPrompt = buildBackendCorrectionPrompt(lastRaw, lastIssues);
    }
  }

  throw new BackendValidationError(lastIssues, usage);
}
