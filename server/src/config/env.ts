import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  CLERK_WEBHOOK_SECRET: z.string().min(1, 'CLERK_WEBHOOK_SECRET is required'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
  AI_PROVIDER: z.enum(['openai']).default('openai'),
  AI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  OPENAI_API_KEY: z.string().optional(),
  // Optional override for the OpenAI SDK's baseURL — lets any OpenAI-API-compatible provider
  // (e.g. OpenRouter: https://openrouter.ai/api/v1) be used without touching provider code.
  // Leave unset to use the real OpenAI API.
  OPENAI_BASE_URL: z.string().url().optional(),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AI_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  MAX_PLANNER_RETRIES: z.coerce.number().int().min(0).default(2),
  PLANNER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  PLANNER_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),

  // Frontend Agent (Phase 6)
  FRONTEND_AGENT_MODEL: z.string().min(1).optional(),
  MAX_CODEGEN_RETRIES: z.coerce.number().int().min(0).default(2),
  MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(12000),
  MAX_FILE_CONTEXT_SIZE: z.coerce.number().int().positive().default(20000),
  MAX_GENERATION_TOKENS: z.coerce.number().int().positive().default(4000),
  // z.coerce.boolean() would treat the literal string "false" as truthy — this flag gates
  // automatic filesystem writes, so it must only be true for the literal string "true".
  AI_AUTO_APPLY: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  MAX_FILES_PER_OPERATION: z.coerce.number().int().positive().default(50),
  MAX_TASK_OPERATIONS: z.coerce.number().int().positive().default(100),
  MAX_TOTAL_OPERATION_SIZE: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  FRONTEND_AGENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  FRONTEND_AGENT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),

  // Backend Agent (Phase 7) — reuses every Frontend Agent limit above (MAX_CODEGEN_RETRIES,
  // MAX_CONTEXT_TOKENS, MAX_FILE_CONTEXT_SIZE, MAX_GENERATION_TOKENS, MAX_FILES_PER_OPERATION,
  // MAX_TASK_OPERATIONS, MAX_TOTAL_OPERATION_SIZE) — only the model override is agent-specific.
  BACKEND_AGENT_MODEL: z.string().min(1).optional(),

  // Database Agent (Phase 8) — same reuse pattern as the Backend Agent above.
  DATABASE_AGENT_MODEL: z.string().min(1).optional(),

  // Testing Agent (Phase 9) — same model-override reuse pattern, plus sandbox execution limits for
  // the ephemeral temp-dir + child_process test runner (no equivalent exists in any earlier phase).
  TESTING_AGENT_MODEL: z.string().min(1).optional(),
  TEST_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  TEST_INSTALL_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  TEST_RUN_MAX_OUTPUT_CHARS: z.coerce.number().int().positive().default(20000),
  TESTING_AGENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  TESTING_AGENT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
  TEST_RUN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  TEST_RUN_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),

  // Multi-Agent Orchestrator (Phase 10) — the scheduler/executor never calls the AI provider
  // directly (it only ever calls the four agents' own service functions, each already configured),
  // so there's no orchestrator-specific model here — only scheduling/safety limits.
  MAX_CONCURRENT_AGENTS: z.coerce.number().int().positive().default(3),
  ORCHESTRATOR_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  ORCHESTRATOR_MAX_FIX_CYCLES: z.coerce.number().int().min(0).default(3),
  ORCHESTRATOR_TASK_TIMEOUT_MS: z.coerce.number().int().positive().default(600000),
  ORCHESTRATOR_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  ORCHESTRATOR_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),

  // Secure Terminal + Sandbox Execution (Phase 11) — every generated/untrusted command now runs in a
  // Docker container, never a host child_process. All limits are configurable; none are required.
  SANDBOX_IMAGE_TAG: z.string().min(1).default('mingo-sandbox:node22-v1'),
  SANDBOX_MEMORY_MB: z.coerce.number().int().positive().default(1024),
  // The sandbox's rootfs is read-only, so `/tmp` (npm's cache + $HOME) is a tmpfs — this is its cap,
  // separate from SANDBOX_MEMORY_MB. 128MB (the original default) overflows on a real `npm install`
  // for anything beyond a trivial project (framework binaries like @next/swc alone can exceed that),
  // producing ENOSPC even though the actual `/workspace` bind mount has plenty of host disk free.
  SANDBOX_TMPFS_MB: z.coerce.number().int().positive().default(512),
  SANDBOX_CPU_CORES: z.coerce.number().positive().default(1.5),
  SANDBOX_PIDS_LIMIT: z.coerce.number().int().positive().default(256),
  SANDBOX_DISK_LIMIT_MB: z.coerce.number().int().positive().default(2048),
  SANDBOX_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  SANDBOX_INSTALL_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  SANDBOX_MAX_LOG_CHARS: z.coerce.number().int().positive().default(200000),
  SANDBOX_ORPHAN_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  SANDBOX_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  SANDBOX_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),

  // GitHub Integration & Version Control (Phase 12) — a standalone GitHub OAuth App, independent of
  // Clerk login. Required so a missing/misconfigured app fails fast at boot rather than surfacing as
  // a confusing 500 the first time a user clicks "Connect GitHub".
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_CALLBACK_URL: z.string().url(),
  // 32-byte (256-bit) key, base64-encoded, used for AES-256-GCM encryption of stored GitHub access
  // tokens at rest (spec §5/§23) — e.g. `openssl rand -base64 32`.
  GITHUB_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1, 'GITHUB_TOKEN_ENCRYPTION_KEY is required')
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'GITHUB_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key'),
  // Root directory for the persistent, per-project real `git` working copies (spec §33/§9's Context
  // decision) — never inside the repo, never served statically. Defaults to a dedicated dir under the
  // OS temp dir so local dev needs no setup.
  GIT_WORKDIR_ROOT: z.string().min(1).optional(),
  GITHUB_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  GITHUB_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),
  // GitHub webhook (push/pull_request → auto-deploy, Phase 13 spec §19) — a separate secret you set
  // when creating the webhook in the repository's GitHub settings. Optional: without it, the webhook
  // route simply rejects every delivery with a clear "not configured" error rather than crashing boot.
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Deployment Engine (Phase 13) — optional: a dev environment without a Render account can still run
  // everything except an actual deploy, which fails with a clear "provider not configured" error
  // instead of crashing boot (unlike GitHub's OAuth app, which the whole GitHub feature needs to even
  // load its routes).
  RENDER_API_KEY: z.string().min(1).optional(),
  HEALTH_CHECK_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DEPLOYMENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  DEPLOYMENT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    console.error(
      `\n[env] Invalid or missing environment variables:\n${missing.join('\n')}\n\nSee server/.env.example for reference.\n`
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
