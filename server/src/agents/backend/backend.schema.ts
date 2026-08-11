import { z } from 'zod';
import { fileNameSchema, relativePathSchema } from 'shared';

/**
 * The Backend Agent AI output contract (Phase 7 spec §27/§28) — structurally identical to
 * `frontend.schema.ts`'s operation union (only `create`/`update`/`delete`/`rename`/`move`, no
 * arbitrary operation type ever reaches the filesystem), plus `apiContracts`: structured metadata
 * for every endpoint the task creates or changes (spec §25/§51).
 */
const MAX_OPERATION_CONTENT_LENGTH = 500_000;

const createOperationSchema = z.object({
  type: z.literal('create'),
  path: relativePathSchema,
  content: z.string().max(MAX_OPERATION_CONTENT_LENGTH).default(''),
  reason: z.string().min(1, 'reason is required'),
});

const updateOperationSchema = z.object({
  type: z.literal('update'),
  path: relativePathSchema,
  content: z.string().max(MAX_OPERATION_CONTENT_LENGTH),
  reason: z.string().min(1, 'reason is required'),
});

const deleteOperationSchema = z.object({
  type: z.literal('delete'),
  path: relativePathSchema,
  reason: z.string().min(1, 'reason is required'),
});

const renameOperationSchema = z.object({
  type: z.literal('rename'),
  path: relativePathSchema,
  newName: fileNameSchema,
  reason: z.string().min(1, 'reason is required'),
});

const moveOperationSchema = z.object({
  type: z.literal('move'),
  path: relativePathSchema,
  destinationPath: relativePathSchema,
  reason: z.string().min(1, 'reason is required'),
});

export const backendOperationSchema = z.discriminatedUnion('type', [
  createOperationSchema,
  updateOperationSchema,
  deleteOperationSchema,
  renameOperationSchema,
  moveOperationSchema,
]);

export type BackendOperationOutput = z.infer<typeof backendOperationSchema>;

const dependencyRequestSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  reason: z.string().min(1),
});

/** Structured API contract metadata (spec §25) — kept loose (`Record<string, unknown>` request/
 *  response shapes) since this describes a JSON schema-ish summary, not a full OpenAPI document. */
const apiContractSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  authentication: z.boolean(),
  request: z.record(z.string(), z.unknown()).optional(),
  response: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.string()).optional(),
});

export type ApiContractOutput = z.infer<typeof apiContractSchema>;

/**
 * `operations` requires at least one entry, same rationale as the Frontend/Planner Agents'
 * `.min(1)` — a task with zero changes isn't actionable.
 */
export const backendOutputSchema = z.object({
  operations: z.array(backendOperationSchema).min(1, 'at least one operation is required'),
  dependencyRequests: z.array(dependencyRequestSchema).default([]),
  apiContracts: z.array(apiContractSchema).default([]),
  notes: z.string().optional(),
});

export type BackendOutput = z.infer<typeof backendOutputSchema>;
