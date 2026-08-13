import { env } from './env';

/**
 * Single source for every Testing Agent limit (Phase 9) — mirrors `databaseAgent.config.ts`'s
 * pattern exactly, reusing the same shared codegen limits so a testing task's cost/size budget
 * doesn't depend on which agent happens to own it. `MODEL` and the sandbox execution limits are the
 * only Testing-Agent-specific values.
 */
export const testingAgentConfig = {
  MODEL: env.TESTING_AGENT_MODEL ?? env.AI_MODEL,
  MAX_CODEGEN_RETRIES: env.MAX_CODEGEN_RETRIES,
  MAX_CONTEXT_TOKENS: env.MAX_CONTEXT_TOKENS,
  MAX_FILE_CONTEXT_SIZE: env.MAX_FILE_CONTEXT_SIZE,
  MAX_GENERATION_TOKENS: env.MAX_GENERATION_TOKENS,
  AI_AUTO_APPLY: env.AI_AUTO_APPLY,
  MAX_FILES_PER_OPERATION: env.MAX_FILES_PER_OPERATION,
  MAX_TASK_OPERATIONS: env.MAX_TASK_OPERATIONS,
  MAX_TOTAL_OPERATION_SIZE: env.MAX_TOTAL_OPERATION_SIZE,
  TEST_RUN_TIMEOUT_MS: env.TEST_RUN_TIMEOUT_MS,
  TEST_INSTALL_TIMEOUT_MS: env.TEST_INSTALL_TIMEOUT_MS,
  TEST_RUN_MAX_OUTPUT_CHARS: env.TEST_RUN_MAX_OUTPUT_CHARS,
};
