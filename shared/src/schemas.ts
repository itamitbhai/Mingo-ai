import { z } from 'zod';
import {
  AuthOption,
  BackendStack,
  BatchOperationType,
  DatabaseOption,
  DeploymentEnvironment,
  DeploymentOption,
  DeploymentServiceType,
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

// ---------------------------------------------------------------------------
// Phase 10 — Multi-Agent Orchestrator
// ---------------------------------------------------------------------------

/** Exactly one of `prompt` (generate + auto-approve a new plan first, mirroring Autopilot's existing
 *  behavior) or `planId` (run against an already-approved plan) must be given — never both, never
 *  neither. */
export const createWorkflowSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(PLAN_PROMPT_MIN_LENGTH, `Describe what you want to build in at least ${PLAN_PROMPT_MIN_LENGTH} characters`)
      .max(PLAN_PROMPT_MAX_LENGTH, `Keep the request under ${PLAN_PROMPT_MAX_LENGTH} characters`)
      .optional(),
    conversationId: z.string().regex(OBJECT_ID_REGEX, 'Invalid conversation id').optional(),
    planId: z.string().regex(OBJECT_ID_REGEX, 'Invalid plan id').optional(),
    mode: z.enum(['auto', 'review']).default('review'),
  })
  .refine((value) => Boolean(value.prompt) !== Boolean(value.planId), {
    message: 'Provide either a prompt or a planId, not both',
  });

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

// ---------------------------------------------------------------------------
// Phase 11 — Secure Terminal + Sandbox Execution Environment
// ---------------------------------------------------------------------------

/** The only binaries a sandbox will ever run this pass (Phase 11 spec §9) — kept here so both the
 *  request schema and any client-side hinting share one source of truth; the server's own
 *  `sandbox.security.ts` is still the actual enforcement point, this is just the Zod-level shape. */
export const SANDBOX_ALLOWED_COMMANDS = ['npm', 'npx', 'node', 'git'] as const;

/** Exactly one of a structured `{ command, args }` (from a trusted internal caller that already knows
 *  the exact argv — the Testing Agent, the Orchestrator) or a free-text `commandLine` (from the
 *  terminal UI, parsed and validated server-side before ever reaching a container) must be given. */
export const createSandboxRunSchema = z
  .object({
    command: z.enum(SANDBOX_ALLOWED_COMMANDS).optional(),
    args: z.array(z.string().max(500)).max(50).optional(),
    commandLine: z.string().trim().min(1).max(1000).optional(),
  })
  .refine((value) => Boolean(value.command) !== Boolean(value.commandLine), {
    message: 'Provide either { command, args } or commandLine, not both',
  });

export type CreateSandboxRunInput = z.infer<typeof createSandboxRunSchema>;

// ---------------------------------------------------------------------------
// Phase 12 — GitHub Integration & Version Control
// ---------------------------------------------------------------------------

const GIT_BRANCH_NAME_REGEX = /^(?!\/|.*\/\/|.*\.\.|.*[~^:?*[\\])[^\s]+(?<!\.lock)(?<!\/)$/;
const branchNameField = z
  .string()
  .trim()
  .min(1, 'Branch name is required')
  .max(200, 'Branch name is too long')
  .regex(GIT_BRANCH_NAME_REGEX, 'Not a valid git branch name');

/** Connects an existing Mingo project to an existing GitHub repository (spec §7). */
export const connectGithubProjectSchema = z.object({
  repositoryFullName: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/, 'Expected "owner/repo"'),
  branch: branchNameField,
});

export type ConnectGithubProjectInput = z.infer<typeof connectGithubProjectSchema>;

/** Imports a GitHub repository as a brand-new Mingo project (spec §8) — the stack fields mirror
 *  `createProjectSchema` exactly (pre-filled client-side from repository analysis, spec §9, but
 *  always explicitly confirmed/submitted by the user, never silently inferred server-side). */
export const importGithubRepoSchema = z.object({
  repositoryFullName: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/, 'Expected "owner/repo"'),
  branch: branchNameField,
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

export type ImportGithubRepoInput = z.infer<typeof importGithubRepoSchema>;

/** Creates a brand-new (empty) GitHub repository for an existing Mingo project (spec §7's "Create
 *  New Repository" variant). */
export const createGithubRepoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Repository name is required')
    .max(100, 'Repository name is too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Repository name may only contain letters, numbers, ., _ and -'),
  description: z.string().trim().max(350).optional(),
  private: z.boolean().default(true),
});

export type CreateGithubRepoInput = z.infer<typeof createGithubRepoSchema>;

export const createGitBranchSchema = z.object({
  name: branchNameField,
  fromBranch: branchNameField.optional(),
});

export type CreateGitBranchInput = z.infer<typeof createGitBranchSchema>;

export const switchGitBranchSchema = z.object({
  branch: branchNameField,
});

export type SwitchGitBranchInput = z.infer<typeof switchGitBranchSchema>;

export const commitChangesSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Commit message is required')
    .max(500, 'Commit message is too long'),
  paths: z.array(z.string().min(1).max(500)).max(500).optional(),
});

export type CommitChangesInput = z.infer<typeof commitChangesSchema>;

export const createPullRequestSchema = z.object({
  baseBranch: branchNameField,
  compareBranch: branchNameField,
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(256, 'Title is too long'),
  description: z.string().trim().max(10000).optional(),
});

export type CreatePullRequestInput = z.infer<typeof createPullRequestSchema>;

export const githubHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GithubHistoryQueryInput = z.infer<typeof githubHistoryQuerySchema>;

export const githubRepositoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type GithubRepositoryQueryInput = z.infer<typeof githubRepositoryQuerySchema>;

/** One conflicted file's resolution (spec §21) — `manual` requires the user's own merged
 *  `content`; `current`/`incoming` keep this side's version wholesale. Never resolved server-side
 *  without one of these being explicitly chosen by the user. */
export const resolveGitConflictSchema = z.object({
  resolution: z.enum(['current', 'incoming', 'manual']),
  content: z.string().max(5_000_000).optional(),
}).refine((value) => value.resolution !== 'manual' || typeof value.content === 'string', {
  message: 'content is required when resolution is "manual"',
});

export type ResolveGitConflictInput = z.infer<typeof resolveGitConflictSchema>;

// ---------------------------------------------------------------------------
// Phase 13 — Deployment Engine, Production Builds & Live Preview
// ---------------------------------------------------------------------------

/** Every deployment-configured command is executed inside the same Docker sandbox every other
 *  command runs in (Phase 11) — so it must pass that sandbox's own binary allowlist
 *  (`SANDBOX_ALLOWED_COMMANDS`, unchanged by this phase) at the Zod level too, not just at execution
 *  time. `npm run build`, not a bare `vite build`. */
const deploymentCommandField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(300, `${label} is too long`)
    .refine((value) => {
      const [first] = value.split(/\s+/);
      return (SANDBOX_ALLOWED_COMMANDS as readonly string[]).includes(first);
    }, `${label} must start with one of: ${SANDBOX_ALLOWED_COMMANDS.join(', ')} (e.g. "npm run build")`);

export const healthCheckConfigSchema = z.object({
  path: z.string().trim().min(1).max(200).default('/'),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
  timeoutSeconds: z.coerce.number().int().min(1).max(120).default(30),
  retries: z.coerce.number().int().min(0).max(10).default(3),
});
export type HealthCheckConfigInput = z.infer<typeof healthCheckConfigSchema>;

const DEFAULT_HEALTH_CHECK: HealthCheckConfigInput = {
  path: '/',
  expectedStatus: 200,
  timeoutSeconds: 30,
  retries: 3,
};

export const deploymentConfigSchema = z.object({
  provider: z.enum(enumValues(DeploymentOption)),
  serviceType: z.enum(enumValues(DeploymentServiceType)),
  environment: z.enum(enumValues(DeploymentEnvironment)).default(DeploymentEnvironment.PRODUCTION),
  branch: z.string().trim().min(1).max(200).default('main'),
  buildCommand: deploymentCommandField('Build command').default('npm run build'),
  startCommand: deploymentCommandField('Start command').optional(),
  testCommand: deploymentCommandField('Test command').optional(),
  outputDirectory: z.string().trim().max(200).optional(),
  rootDirectory: z.string().trim().max(200).optional(),
  framework: z.string().trim().max(100).optional(),
  nodeVersion: z.string().trim().max(20).optional(),
  autoDeploy: z.boolean().default(false),
  healthCheck: healthCheckConfigSchema.default(DEFAULT_HEALTH_CHECK),
}).refine((value) => value.serviceType === DeploymentServiceType.STATIC_SITE || Boolean(value.startCommand), {
  message: 'Start command is required for a web service',
  path: ['startCommand'],
});
export type DeploymentConfigInput = z.infer<typeof deploymentConfigSchema>;

const ENV_VAR_KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;

export const createEnvironmentVariableSchema = z.object({
  environment: z.enum(enumValues(DeploymentEnvironment)),
  key: z
    .string()
    .trim()
    .max(100)
    .regex(ENV_VAR_KEY_REGEX, 'Keys must be UPPER_SNAKE_CASE (e.g. DATABASE_URL)'),
  value: z.string().max(10000),
});
export type CreateEnvironmentVariableInput = z.infer<typeof createEnvironmentVariableSchema>;

export const updateEnvironmentVariableSchema = z.object({
  value: z.string().max(10000),
});
export type UpdateEnvironmentVariableInput = z.infer<typeof updateEnvironmentVariableSchema>;

/** `allowDirty` is the explicit, user-chosen override spec §16 requires before deploying workspace
 *  content that differs from what's on GitHub — never defaulted to true. */
export const createDeploymentSchema = z.object({
  environment: z.enum(enumValues(DeploymentEnvironment)).default(DeploymentEnvironment.PRODUCTION),
  branch: z.string().trim().min(1).max(200).optional(),
  allowDirty: z.boolean().default(false),
});
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;

export const deploymentHistoryQuerySchema = z.object({
  environment: z.enum(enumValues(DeploymentEnvironment)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DeploymentHistoryQueryInput = z.infer<typeof deploymentHistoryQuerySchema>;
