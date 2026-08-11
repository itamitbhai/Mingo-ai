import { env } from './env';

/**
 * Single source for every Frontend Agent limit (spec §22) — mirrors `workspace.config.ts`'s
 * pattern of one config object every service imports from, instead of hardcoding limits inline.
 */
export const frontendAgentConfig = {
  MODEL: env.FRONTEND_AGENT_MODEL ?? env.AI_MODEL,
  MAX_CODEGEN_RETRIES: env.MAX_CODEGEN_RETRIES,
  MAX_CONTEXT_TOKENS: env.MAX_CONTEXT_TOKENS,
  MAX_FILE_CONTEXT_SIZE: env.MAX_FILE_CONTEXT_SIZE,
  MAX_GENERATION_TOKENS: env.MAX_GENERATION_TOKENS,
  AI_AUTO_APPLY: env.AI_AUTO_APPLY,
  MAX_FILES_PER_OPERATION: env.MAX_FILES_PER_OPERATION,
  MAX_TASK_OPERATIONS: env.MAX_TASK_OPERATIONS,
  MAX_TOTAL_OPERATION_SIZE: env.MAX_TOTAL_OPERATION_SIZE,
};
