import { env } from './env';

/**
 * Single source for every Backend Agent limit (Phase 7 spec §22) — mirrors
 * `frontendAgent.config.ts`'s pattern exactly, and deliberately reuses the same shared limits
 * (retries/context/generation/operation caps) so a task's cost/size budget doesn't depend on which
 * agent happens to own it. Only the model is agent-specific.
 */
export const backendAgentConfig = {
  MODEL: env.BACKEND_AGENT_MODEL ?? env.AI_MODEL,
  MAX_CODEGEN_RETRIES: env.MAX_CODEGEN_RETRIES,
  MAX_CONTEXT_TOKENS: env.MAX_CONTEXT_TOKENS,
  MAX_FILE_CONTEXT_SIZE: env.MAX_FILE_CONTEXT_SIZE,
  MAX_GENERATION_TOKENS: env.MAX_GENERATION_TOKENS,
  AI_AUTO_APPLY: env.AI_AUTO_APPLY,
  MAX_FILES_PER_OPERATION: env.MAX_FILES_PER_OPERATION,
  MAX_TASK_OPERATIONS: env.MAX_TASK_OPERATIONS,
  MAX_TOTAL_OPERATION_SIZE: env.MAX_TOTAL_OPERATION_SIZE,
};
