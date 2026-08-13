import { z } from 'zod';
import {
  AuthOption,
  BackendStack,
  BatchOperationType,
  DatabaseOption,
  DeploymentOption,
  FrontendStack,
  ProjectStatus,
  StylingOption,
  TaskPriority,
  Theme,
} from './enums';
import { MAX_BATCH_OPERATIONS } from './constants';
import { isValidRelativePath, normalizeRelativePath } from './utils';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const FILENAME_REGEX = /^[^/\\\0]+$/;

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Project name must be at least 3 characters')
    .max(60, 'Project name must be at most 60 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  frontend: z.enum(enumValues(FrontendStack)),
  backend: z.enum(enumValues(BackendStack)),
  database: z.enum(enumValues(DatabaseOption)),
  authentication: z.enum(enumValues(AuthOption)),
  styling: z.enum(enumValues(StylingOption)),
  deployment: z.enum(enumValues(DeploymentOption)),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(enumValues(ProjectStatus)).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(enumValues(ProjectStatus)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(9),
  sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
});

export type ProjectQueryInput = z.infer<typeof projectQuerySchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(50).optional(),
  bio: z.string().trim().max(280, 'Bio must be at most 280 characters').optional(),
  workspace: z.string().trim().min(2).max(50).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateSettingsSchema = z.object({
  theme: z.enum(enumValues(Theme)).optional(),
  notifications: z
    .object({
      productUpdates: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      projectActivity: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
      marketingEmails: z.boolean().optional(),
    })
    .partial()
    .optional(),
  security: z
    .object({
      twoFactorEnabled: z.boolean().optional(),
    })
    .partial()
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(80, 'Title must be at most 80 characters'),
});

export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

export const MESSAGE_MAX_LENGTH = 8000;

export const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH).optional(),
    retryMessageId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'Invalid message id')
      .optional(),
  })
  .refine((data) => Boolean(data.content) !== Boolean(data.retryMessageId), {
    message: 'Provide exactly one of "content" or "retryMessageId"',
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messageQuerySchema = z.object({
  cursor: z.string().regex(OBJECT_ID_REGEX, 'Invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type MessageQueryInput = z.infer<typeof messageQuerySchema>;

export const MAX_FILE_CONTENT_LENGTH = 2_000_000;

export const fileNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(255, 'Name is too long')
  .refine((value) => FILENAME_REGEX.test(value) && value !== '.' && value !== '..', {
    message: 'Invalid file name',
  });

export type FileNameInput = z.infer<typeof fileNameSchema>;

export const relativePathSchema = z
  .string()
  .trim()
  .transform((value) => normalizeRelativePath(value))
  .refine((value) => isValidRelativePath(value), { message: 'Invalid path' });

export const createFileSchema = z.object({
  path: relativePathSchema,
  content: z.string().max(MAX_FILE_CONTENT_LENGTH).optional(),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;

export const createFolderSchema = z.object({
  path: relativePathSchema,
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFileContentSchema = z.object({
  path: relativePathSchema,
  content: z.string().max(MAX_FILE_CONTENT_LENGTH),
  expectedVersion: z.number().int().positive().optional(),
});

export type UpdateFileContentInput = z.infer<typeof updateFileContentSchema>;

export const renameEntrySchema = z.object({
  path: relativePathSchema,
  newName: fileNameSchema,
});

export type RenameEntryInput = z.infer<typeof renameEntrySchema>;

export const deleteEntrySchema = z.object({
  path: relativePathSchema,
});

export type DeleteEntryInput = z.infer<typeof deleteEntrySchema>;

export const fileContentQuerySchema = z.object({
  path: relativePathSchema,
});

export type FileContentQueryInput = z.infer<typeof fileContentQuerySchema>;

export const fileSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(200),
});

export type FileSearchQueryInput = z.infer<typeof fileSearchQuerySchema>;

export const moveEntrySchema = z.object({
  path: relativePathSchema,
  destinationPath: relativePathSchema,
});

export type MoveEntryInput = z.infer<typeof moveEntrySchema>;

export const createSnapshotSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().trim().max(500, 'Description is too long').optional(),
});

export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;

export const activityQuerySchema = z.object({
  cursor: z.string().regex(OBJECT_ID_REGEX, 'Invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

export const versionsQuerySchema = z.object({
  path: relativePathSchema,
  cursor: z.string().regex(OBJECT_ID_REGEX, 'Invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type VersionsQueryInput = z.infer<typeof versionsQuerySchema>;

export const snapshotsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SnapshotsQueryInput = z.infer<typeof snapshotsQuerySchema>;

const batchCreateOpSchema = z.object({
  type: z.literal(BatchOperationType.CREATE),
  path: relativePathSchema,
  content: z.string().max(MAX_FILE_CONTENT_LENGTH).optional(),
});

const batchUpdateOpSchema = z.object({
  type: z.literal(BatchOperationType.UPDATE),
  path: relativePathSchema,
  content: z.string().max(MAX_FILE_CONTENT_LENGTH),
});

const batchDeleteOpSchema = z.object({
  type: z.literal(BatchOperationType.DELETE),
  path: relativePathSchema,
});

const batchRenameOpSchema = z.object({
  type: z.literal(BatchOperationType.RENAME),
  path: relativePathSchema,
  newName: fileNameSchema,
});

const batchMoveOpSchema = z.object({
  type: z.literal(BatchOperationType.MOVE),
  path: relativePathSchema,
  destinationPath: relativePathSchema,
});

export const batchOperationSchema = z.discriminatedUnion('type', [
  batchCreateOpSchema,
  batchUpdateOpSchema,
  batchDeleteOpSchema,
  batchRenameOpSchema,
  batchMoveOpSchema,
]);

export type BatchOperationInput = z.infer<typeof batchOperationSchema>;

export const batchOperationsSchema = z.object({
  operations: z
    .array(batchOperationSchema)
    .min(1, 'At least one operation is required')
    .max(MAX_BATCH_OPERATIONS, `A batch may contain at most ${MAX_BATCH_OPERATIONS} operations`),
});

export type BatchOperationsInput = z.infer<typeof batchOperationsSchema>;

// ---------------------------------------------------------------------------
// Phase 5 — Planner Agent
// ---------------------------------------------------------------------------

export const PLAN_PROMPT_MIN_LENGTH = 10;
export const PLAN_PROMPT_MAX_LENGTH = 2000;

export const generatePlanSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(PLAN_PROMPT_MIN_LENGTH, `Describe what you want to build in at least ${PLAN_PROMPT_MIN_LENGTH} characters`)
    .max(PLAN_PROMPT_MAX_LENGTH, `Keep the request under ${PLAN_PROMPT_MAX_LENGTH} characters`),
  conversationId: z.string().regex(OBJECT_ID_REGEX, 'Invalid conversation id').optional(),
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

export const regeneratePlanSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(PLAN_PROMPT_MIN_LENGTH)
    .max(PLAN_PROMPT_MAX_LENGTH)
    .optional(),
});

export type RegeneratePlanInput = z.infer<typeof regeneratePlanSchema>;

const featureEditSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  priority: z.enum(enumValues(TaskPriority)).optional(),
});

const taskEditSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});

export const updatePlanSchema = z
  .object({
    status: z.enum(['approved', 'rejected']).optional(),
    featureEdits: z.array(featureEditSchema).max(50).optional(),
    taskEdits: z.array(taskEditSchema).max(200).optional(),
  })
  .refine(
    (data) => Boolean(data.status) || Boolean(data.featureEdits?.length) || Boolean(data.taskEdits?.length),
    { message: 'Provide a status change or at least one feature/task edit' }
  );

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const plansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type PlansQueryInput = z.infer<typeof plansQuerySchema>;

// ---------------------------------------------------------------------------
// Phase 6 — Frontend Agent
// ---------------------------------------------------------------------------

export const FEEDBACK_MAX_LENGTH = 1000;

export const regenerateTaskSchema = z.object({
  feedback: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH).optional(),
});

export type RegenerateTaskInput = z.infer<typeof regenerateTaskSchema>;

export const applyGenerationSchema = z.object({
  generationId: z.string().regex(OBJECT_ID_REGEX, 'Invalid generation id'),
});

export type ApplyGenerationInput = z.infer<typeof applyGenerationSchema>;

// ---------------------------------------------------------------------------
// Phase 9 — Testing Agent
// ---------------------------------------------------------------------------

/** What subset of tests to run (spec §62): every test, only the previously-failed ones, one
 *  `TestType` category, or a single test file (e.g. re-running just the file a fix targeted). */
export const testRunScopeSchema = z.union([
  z.literal('all'),
  z.literal('failed'),
  z.enum(['unit', 'api', 'integration', 'component', 'security']),
  z.object({ file: relativePathSchema }),
]);

export const createTestRunSchema = z.object({
  planId: z.string().regex(OBJECT_ID_REGEX, 'Invalid plan id'),
  taskId: z.string().min(1),
  scope: testRunScopeSchema.default('all'),
});

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;

export const testRunQuerySchema = z.object({
  planId: z.string().regex(OBJECT_ID_REGEX, 'Invalid plan id'),
  taskId: z.string().min(1),
});

export type TestRunQueryInput = z.infer<typeof testRunQuerySchema>;

export const rejectGenerationSchema = z.object({
  generationId: z.string().regex(OBJECT_ID_REGEX, 'Invalid generation id'),
});

export type RejectGenerationInput = z.infer<typeof rejectGenerationSchema>;
