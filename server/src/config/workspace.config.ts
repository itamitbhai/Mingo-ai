import { MAX_BATCH_OPERATIONS as SHARED_MAX_BATCH_OPERATIONS, MAX_FILE_CONTENT_LENGTH } from 'shared';
import { z } from 'zod';

const workspaceLimitsSchema = z.object({
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(MAX_FILE_CONTENT_LENGTH),
  MAX_BATCH_OPERATIONS: z.coerce.number().int().positive().default(SHARED_MAX_BATCH_OPERATIONS),
  MAX_PROJECT_FILES: z.coerce.number().int().positive().default(2000),
  MAX_PATH_LENGTH: z.coerce.number().int().positive().default(500),
  LOCK_TTL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  CACHE_TTL_MS: z.coerce.number().int().positive().default(30 * 1000),
});

/**
 * Single source for every workspace-related limit (spec §45) — every service imports from here
 * instead of hardcoding its own cap. Falls back to the same limits already enforced by the
 * `shared` Zod schemas so the two layers can never silently drift apart.
 */
export const workspaceConfig = workspaceLimitsSchema.parse({
  MAX_FILE_SIZE_BYTES: process.env.WORKSPACE_MAX_FILE_SIZE_BYTES,
  MAX_BATCH_OPERATIONS: process.env.WORKSPACE_MAX_BATCH_OPERATIONS,
  MAX_PROJECT_FILES: process.env.WORKSPACE_MAX_PROJECT_FILES,
  MAX_PATH_LENGTH: process.env.WORKSPACE_MAX_PATH_LENGTH,
  LOCK_TTL_MS: process.env.WORKSPACE_LOCK_TTL_MS,
  CACHE_TTL_MS: process.env.WORKSPACE_CACHE_TTL_MS,
});
