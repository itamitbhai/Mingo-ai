import { z } from 'zod';
import { fileNameSchema, relativePathSchema } from 'shared';

/**
 * The Testing Agent AI output contract (Phase 9 spec §23/§24) — structurally identical to
 * `database.schema.ts`'s operation union (only `create`/`update`/`delete`/`rename`/`move`, full file
 * content, no arbitrary operation type), plus `testPlan` (spec §24) instead of Database's
 * `schemaContracts`/`databaseChanges`.
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

export const testingOperationSchema = z.discriminatedUnion('type', [
  createOperationSchema,
  updateOperationSchema,
  deleteOperationSchema,
  renameOperationSchema,
  moveOperationSchema,
]);

export type TestingOperationOutput = z.infer<typeof testingOperationSchema>;

const dependencyRequestSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  reason: z.string().min(1),
});

const testSuitePlanSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['unit', 'api', 'integration', 'component', 'security']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  tests: z.array(z.string().min(1)).default([]),
});

export type TestSuitePlanOutput = z.infer<typeof testSuitePlanSchema>;

/** `operations` requires at least one entry — same rationale as every other agent's `.min(1)`: a
 *  testing task with zero generated files isn't actionable. */
export const testingOutputSchema = z.object({
  operations: z.array(testingOperationSchema).min(1, 'at least one operation is required'),
  dependencyRequests: z.array(dependencyRequestSchema).default([]),
  testPlan: z.array(testSuitePlanSchema).default([]),
  contractWarnings: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type TestingOutput = z.infer<typeof testingOutputSchema>;
