import { z } from 'zod';
import { fileNameSchema, relativePathSchema } from 'shared';

/**
 * The Database Agent AI output contract (Phase 8 spec §28/§29) — structurally identical to
 * `backend.schema.ts`'s operation union (only `create`/`update`/`delete`/`rename`/`move`, no
 * arbitrary operation type ever reaches the filesystem), plus `schemaContracts` (one entry per
 * Mongoose model created/changed, spec §27) and `databaseChanges` (a lighter change-log for the
 * preview UI, spec §32/§68).
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

export const databaseOperationSchema = z.discriminatedUnion('type', [
  createOperationSchema,
  updateOperationSchema,
  deleteOperationSchema,
  renameOperationSchema,
  moveOperationSchema,
]);

export type DatabaseOperationOutput = z.infer<typeof databaseOperationSchema>;

const dependencyRequestSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  reason: z.string().min(1),
});

const fieldContractSchema = z.object({
  type: z.string().min(1),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
  ref: z.string().optional(),
  unique: z.boolean().optional(),
});

const indexContractSchema = z.object({
  fields: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])),
  unique: z.boolean().optional(),
  reason: z.string().optional(),
});

/** One Mongoose model's structural metadata (spec §27) — kept as a short shape summary
 *  (`Record<string, FieldContract>`), not a full Mongoose `SchemaDefinition`. */
const schemaContractSchema = z.object({
  model: z.string().min(1),
  collection: z.string().min(1),
  fields: z.record(z.string(), fieldContractSchema),
  indexes: z.array(indexContractSchema).default([]),
});

export type SchemaContractOutput = z.infer<typeof schemaContractSchema>;

const databaseChangeSchema = z.object({
  type: z.enum(['model', 'schema', 'index', 'relation', 'seed', 'validation']),
  model: z.string().min(1),
  fields: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().optional(),
});

/**
 * `operations` requires at least one entry, same rationale as the Frontend/Backend/Planner
 * Agents' `.min(1)` — a task with zero changes isn't actionable.
 */
export const databaseOutputSchema = z.object({
  operations: z.array(databaseOperationSchema).min(1, 'at least one operation is required'),
  dependencyRequests: z.array(dependencyRequestSchema).default([]),
  schemaContracts: z.array(schemaContractSchema).default([]),
  databaseChanges: z.array(databaseChangeSchema).default([]),
  notes: z.string().optional(),
});

export type DatabaseOutput = z.infer<typeof databaseOutputSchema>;
