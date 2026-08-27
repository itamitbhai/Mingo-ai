import { env } from './env';

/**
 * Single source for every Orchestrator limit (Phase 10) — mirrors the other agents' `*.config.ts`
 * pattern. The orchestrator itself never calls an AI provider, so unlike every agent config this
 * carries no `MODEL` — only scheduling/retry/fix-loop/timeout limits.
 */
export const orchestratorConfig = {
  MAX_CONCURRENT_AGENTS: env.MAX_CONCURRENT_AGENTS,
  MAX_RETRIES: env.ORCHESTRATOR_MAX_RETRIES,
  MAX_FIX_CYCLES: env.ORCHESTRATOR_MAX_FIX_CYCLES,
  TASK_TIMEOUT_MS: env.ORCHESTRATOR_TASK_TIMEOUT_MS,
  MAX_EVENTS: 200,
};
