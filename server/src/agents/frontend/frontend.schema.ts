import { z } from 'zod';
import { fileNameSchema, relativePathSchema } from 'shared';

/**
 * The Frontend Agent AI output contract (spec §20/§21). Only `create`/`update`/`delete`/`rename`/
 * `move` are allowed — no arbitrary operation types ever reach the filesystem. Reuses `shared`'s
 * `relativePathSchema`/`fileNameSchema` so a valid operation here is, by construction, already
 * shaped the way Phase 4's `preview.service`/`batch.service` expect (spec §18).
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

export const frontendOperationSchema = z.discriminatedUnion('type', [
  createOperationSchema,
  updateOperationSchema,
  deleteOperationSchema,
  renameOperationSchema,
  moveOperationSchema,
]);

export type FrontendOperationOutput = z.infer<typeof frontendOperationSchema>;

const dependencyRequestSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  reason: z.string().min(1),
});

/**
 * `operations` requires at least one entry (a task with zero changes isn't actionable), same
 * rationale as the Planner's `tasks.min(1)` (planner.schema.ts).
 */
export const frontendOutputSchema = z.object({
  operations: z.array(frontendOperationSchema).min(1, 'at least one operation is required'),
  dependencyRequests: z.array(dependencyRequestSchema).default([]),
  notes: z.string().optional(),
});

export type FrontendOutput = z.infer<typeof frontendOutputSchema>;
