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
