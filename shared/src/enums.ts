export const FrontendStack = {
  REACT: 'React',
  NEXTJS: 'Next.js',
  VUE: 'Vue',
} as const;
export type FrontendStack = (typeof FrontendStack)[keyof typeof FrontendStack];

export const BackendStack = {
  EXPRESS: 'Express',
  NODE: 'Node',
  NESTJS: 'NestJS',
} as const;
export type BackendStack = (typeof BackendStack)[keyof typeof BackendStack];

export const DatabaseOption = {
  MONGODB: 'MongoDB',
} as const;
export type DatabaseOption = (typeof DatabaseOption)[keyof typeof DatabaseOption];

export const AuthOption = {
  JWT: 'JWT',
  CLERK: 'Clerk',
  FIREBASE: 'Firebase',
} as const;
export type AuthOption = (typeof AuthOption)[keyof typeof AuthOption];

export const StylingOption = {
  TAILWIND: 'Tailwind',
  SHADCN: 'Shadcn',
} as const;
export type StylingOption = (typeof StylingOption)[keyof typeof StylingOption];

export const DeploymentOption = {
  VERCEL: 'Vercel',
  RAILWAY: 'Railway',
  RENDER: 'Render',
} as const;
export type DeploymentOption = (typeof DeploymentOption)[keyof typeof DeploymentOption];

export const ProjectStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/** Coarse deployment lifecycle (Phase 13 spec §29) — `PENDING`/`BUILDING`/`SUCCESS`/`FAILED` predate
 *  Phase 13 and keep their meaning; the rest fill out the full run lifecycle. The fine-grained
 *  current pipeline step (installing/testing/building/health-checking/...) is tracked separately by
 *  `DeploymentStage`, since a single `BUILDING`-ish status can't distinguish those for the progress UI. */
export const DeploymentStatus = {
  QUEUED: 'queued',
  PENDING: 'pending',
  RUNNING: 'running',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ROLLED_BACK: 'rolled_back',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

/** The current pipeline step of a `RUNNING` deployment (Phase 13 spec §11) — purely informational
 *  (drives the live progress UI/logs), never itself the authorization for marking a deployment
 *  successful; only a passed health check does that (spec §7/§25). */
export const DeploymentStage = {
  PREPARING: 'preparing',
  VALIDATING: 'validating',
  INSTALLING: 'installing',
  TESTING: 'testing',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  HEALTH_CHECKING: 'health_checking',
  COMPLETE: 'complete',
} as const;
export type DeploymentStage = (typeof DeploymentStage)[keyof typeof DeploymentStage];

/** What kind of service a deployment provider should create (Phase 13 spec §6/§7). Deliberately an
 *  explicit user choice on `DeploymentConfig`, not inferred from `Project.frontend`/`backend` —
 *  this codebase's project creation form only ever shows/hides which stack fields to fill in
 *  client-side (`project-form.tsx`'s local `projectType` state); a saved `Project` document always
 *  has concrete `backend`/`database` values regardless of what the user intended, so it can't be
 *  used as a reliable "is this frontend-only" signal. One `DeploymentConfig` deploys one service
 *  this pass — a project that truly needs a separate frontend + backend service is configured as
 *  two environments' worth of config today (a documented scope limit, not a silent gap). */
export const DeploymentServiceType = {
  STATIC_SITE: 'static_site',
  WEB_SERVICE: 'web_service',
} as const;
export type DeploymentServiceType = (typeof DeploymentServiceType)[keyof typeof DeploymentServiceType];

/** Kept distinct from `WorkspaceStatus`'s dev/preview split and from `ProjectStatus` — this is which
 *  deployment target a `Deployment`/`DeploymentConfig`/`EnvironmentVariable` belongs to (spec §8). */
export const DeploymentEnvironment = {
  DEVELOPMENT: 'development',
  PREVIEW: 'preview',
  PRODUCTION: 'production',
} as const;
export type DeploymentEnvironment = (typeof DeploymentEnvironment)[keyof typeof DeploymentEnvironment];

/** Whether a deployment's post-deploy health check has run yet and what it found (spec §25/§26) — a
 *  deployment is never marked `DeploymentStatus.SUCCESS` while this is anything but `PASSED`. */
export const HealthCheckStatus = {
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
} as const;
export type HealthCheckStatus = (typeof HealthCheckStatus)[keyof typeof HealthCheckStatus];

/** Real-time deployment pipeline events (Phase 13 spec §11/§34) — same allowlisted-payload style as
 *  `WorkflowEventType`/`SandboxEventType`/`GitHubEventType`: never a raw error object, secret, or env.
 *  Streamed over the deployment-scoped SSE channel in `deployment.events.ts`. */
export const DeploymentEventType = {
  STARTED: 'deployment:started',
  VALIDATION: 'deployment:validation',
  INSTALL: 'deployment:install',
  TEST: 'deployment:test',
  BUILD: 'deployment:build',
  UPLOAD: 'deployment:upload',
  DEPLOYING: 'deployment:deploying',
  HEALTHCHECK: 'deployment:healthcheck',
  SUCCESS: 'deployment:success',
  FAILED: 'deployment:failed',
  CANCELLED: 'deployment:cancelled',
} as const;
export type DeploymentEventType = (typeof DeploymentEventType)[keyof typeof DeploymentEventType];

/** What started a deployment (Phase 13 spec §18/§19/§20). `WEBHOOK` and `ROLLBACK` both pin to an
 *  already-known commit fetched straight from GitHub — the pipeline skips Mingo's own local
 *  install/test/build pre-flight for both, since it would be validating potentially-stale Mongo VFS
 *  content instead of the actual commit being deployed; only `MANUAL` runs the local pre-flight. */
export const DeploymentTrigger = {
  MANUAL: 'manual',
  WEBHOOK: 'webhook',
  ROLLBACK: 'rollback',
} as const;
export type DeploymentTrigger = (typeof DeploymentTrigger)[keyof typeof DeploymentTrigger];

export const PlanType = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;
export type PlanType = (typeof PlanType)[keyof typeof PlanType];

export const ActivityType = {
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_ARCHIVED: 'project.archived',
  PROJECT_DUPLICATED: 'project.duplicated',
  DEPLOYMENT_TRIGGERED: 'deployment.triggered',
  DEPLOYMENT_SUCCEEDED: 'deployment.succeeded',
  DEPLOYMENT_FAILED: 'deployment.failed',
  DEPLOYMENT_ROLLED_BACK: 'deployment.rolled_back',
  ENV_VAR_CREATED: 'env_var.created',
  ENV_VAR_UPDATED: 'env_var.updated',
  ENV_VAR_DELETED: 'env_var.deleted',
  AUTO_DEPLOY_ENABLED: 'auto_deploy.enabled',
  AUTO_DEPLOY_DISABLED: 'auto_deploy.disabled',
  PRODUCTION_DEPLOY_APPROVED: 'deployment.production_approved',
  PROFILE_UPDATED: 'profile.updated',
  WORKSPACE_CREATED: 'workspace.created',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const MessageStatus = {
  PENDING: 'pending',
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const AIProvider = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
} as const;
export type AIProvider = (typeof AIProvider)[keyof typeof AIProvider];

export const FileEntryType = {
  FILE: 'file',
  FOLDER: 'folder',
} as const;
export type FileEntryType = (typeof FileEntryType)[keyof typeof FileEntryType];

export const WorkspaceStatus = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  SAVING: 'saving',
  ERROR: 'error',
  ARCHIVED: 'archived',
} as const;
export type WorkspaceStatus = (typeof WorkspaceStatus)[keyof typeof WorkspaceStatus];

export const FileChangeType = {
  CREATE: 'create',
  UPDATE: 'update',
  RENAME: 'rename',
  MOVE: 'move',
  RESTORE: 'restore',
  DELETE: 'delete',
} as const;
export type FileChangeType = (typeof FileChangeType)[keyof typeof FileChangeType];

export const WorkspaceActivityAction = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RENAME: 'rename',
  MOVE: 'move',
  RESTORE: 'restore',
  SNAPSHOT: 'snapshot',
  WORKSPACE_INIT: 'workspace_init',
} as const;
export type WorkspaceActivityAction =
  (typeof WorkspaceActivityAction)[keyof typeof WorkspaceActivityAction];

export const LockType = {
  USER: 'user',
  AGENT: 'agent',
  SYSTEM: 'system',
} as const;
export type LockType = (typeof LockType)[keyof typeof LockType];

export const BatchOperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RENAME: 'rename',
  MOVE: 'move',
} as const;
export type BatchOperationType = (typeof BatchOperationType)[keyof typeof BatchOperationType];

/** Distinct from the billing `PlanType` enum above — this is the status of an AI-generated
 *  `ProjectPlan` document, not a subscription tier. */
export const ProjectPlanStatus = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  READY: 'ready',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type ProjectPlanStatus = (typeof ProjectPlanStatus)[keyof typeof ProjectPlanStatus];

export const TaskPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TaskComplexity = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  COMPLEX: 'complex',
} as const;
export type TaskComplexity = (typeof TaskComplexity)[keyof typeof TaskComplexity];

export const TaskType = {
  SETUP: 'setup',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DATABASE: 'database',
  AUTHENTICATION: 'authentication',
  INTEGRATION: 'integration',
  TESTING: 'testing',
  CONFIGURATION: 'configuration',
  DOCUMENTATION: 'documentation',
  SECURITY: 'security',
  DEPLOYMENT: 'deployment',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

/** How a technology/requirement entry was determined — never let an inferred choice be displayed
 *  or treated as something the user explicitly asked for. */
export const TechSource = {
  USER_SELECTED: 'user_selected',
  INFERRED: 'inferred',
  RECOMMENDED: 'recommended',
} as const;
export type TechSource = (typeof TechSource)[keyof typeof TechSource];

/** Future agents a task could be handed to. None of these agents exist yet (Phase 5 is planning
 *  only) — this just keeps the schema forward-compatible. */
export const RecommendedAgent = {
  PLANNER: 'planner',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DATABASE: 'database',
  TESTING: 'testing',
  DEVOPS: 'devops',
  SECURITY: 'security',
} as const;
export type RecommendedAgent = (typeof RecommendedAgent)[keyof typeof RecommendedAgent];

export const RiskSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type RiskSeverity = (typeof RiskSeverity)[keyof typeof RiskSeverity];

export const NonFunctionalCategory = {
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  SCALABILITY: 'scalability',
  ACCESSIBILITY: 'accessibility',
  RESPONSIVENESS: 'responsiveness',
  MAINTAINABILITY: 'maintainability',
  OBSERVABILITY: 'observability',
  RELIABILITY: 'reliability',
} as const;
export type NonFunctionalCategory =
  (typeof NonFunctionalCategory)[keyof typeof NonFunctionalCategory];

export const ArchitectureNodeType = {
  FRONTEND: 'frontend',
  API: 'api',
  SERVICE: 'service',
  DATABASE: 'database',
  AUTH: 'auth',
  EXTERNAL: 'external',
  STORAGE: 'storage',
  DEPLOYMENT: 'deployment',
} as const;
export type ArchitectureNodeType = (typeof ArchitectureNodeType)[keyof typeof ArchitectureNodeType];

export const DatabaseRelationType = {
  ONE_TO_ONE: 'one-to-one',
  ONE_TO_MANY: 'one-to-many',
  MANY_TO_MANY: 'many-to-many',
} as const;
export type DatabaseRelationType = (typeof DatabaseRelationType)[keyof typeof DatabaseRelationType];

/** Per-task execution status (Phase 6). Lives outside `ProjectPlan.tasks` — the plan itself is
 *  immutable/versioned, so a task's run state is tracked separately in `TaskExecution`. */
export const TaskExecutionStatus = {
  PENDING: 'pending',
  READY: 'ready',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
  SKIPPED: 'skipped',
} as const;
export type TaskExecutionStatus = (typeof TaskExecutionStatus)[keyof typeof TaskExecutionStatus];

/** Lifecycle of a single Frontend Agent code-generation attempt (`AgentGeneration`, Phase 6). */
export const AgentGenerationStatus = {
  QUEUED: 'queued',
  ANALYZING: 'analyzing',
  READING_CONTEXT: 'reading_context',
  PLANNING: 'planning',
  GENERATING: 'generating',
  VALIDATING: 'validating',
  PREVIEW_READY: 'preview_ready',
  APPROVED: 'approved',
  APPLYING: 'applying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
} as const;
export type AgentGenerationStatus = (typeof AgentGenerationStatus)[keyof typeof AgentGenerationStatus];

/** File operation types a Frontend Agent may propose. Same value set as `BatchOperationType` —
 *  kept as its own name so agent code reads clearly as "AI-proposed operation", not "raw batch op". */
export const FrontendOperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RENAME: 'rename',
  MOVE: 'move',
} as const;
export type FrontendOperationType = (typeof FrontendOperationType)[keyof typeof FrontendOperationType];

/** A generated test suite's category (Phase 9 spec §3/§24) — E2E is intentionally omitted for now;
 *  Playwright generation/execution is a deferred fast-follow, not part of this pass. */
export const TestType = {
  UNIT: 'unit',
  API: 'api',
  INTEGRATION: 'integration',
  COMPONENT: 'component',
  SECURITY: 'security',
} as const;
export type TestType = (typeof TestType)[keyof typeof TestType];

/** One executed test's real outcome (Phase 9 spec §34) — never written unless a test runner actually
 *  produced it (a parsed reporter file or, at minimum, the process's own exit code). */
export const TestResultStatus = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;
export type TestResultStatus = (typeof TestResultStatus)[keyof typeof TestResultStatus];

/** Lifecycle of a single `TestRun` (Phase 9 spec §35) — trimmed to states the sandbox execution
 *  engine can honestly produce; `blocked` isn't here because a blocked run is rejected before a
 *  `TestRun` document is ever created. */
export const TestRunStatus = {
  QUEUED: 'queued',
  PREPARING: 'preparing',
  INSTALLING: 'installing',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;
export type TestRunStatus = (typeof TestRunStatus)[keyof typeof TestRunStatus];

/** Lifecycle of a `Workflow` — the Orchestrator's persisted, resumable run (Phase 10 spec §6). */
export const WorkflowStatus = {
  CREATED: 'created',
  PLANNING: 'planning',
  PLANNED: 'planned',
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  WAITING_FOR_APPROVAL: 'waiting_for_approval',
  FIXING: 'fixing',
  TESTING: 'testing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

/** Per-task state within a `Workflow` (Phase 10 spec §5) — richer than `TaskExecutionStatus` because
 *  the orchestrator needs to distinguish "blocked by an unmet dependency" from "ready to schedule"
 *  from "queued behind the concurrency limit," none of which the simpler per-task `TaskExecution`
 *  status needs to represent on its own. */
export const WorkflowTaskStatus = {
  PENDING: 'pending',
  BLOCKED: 'blocked',
  READY: 'ready',
  QUEUED: 'queued',
  RUNNING: 'running',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RETRYING: 'retrying',
  SKIPPED: 'skipped',
  NEEDS_REVIEW: 'needs_review',
} as const;
export type WorkflowTaskStatus = (typeof WorkflowTaskStatus)[keyof typeof WorkflowTaskStatus];

/** Whether a workflow auto-applies safe generations or stops for review on every one (Phase 10
 *  spec §16) — a per-workflow flag, never a repurposing of the global `AI_AUTO_APPLY` safety switch. */
export const WorkflowMode = {
  AUTO: 'auto',
  REVIEW: 'review',
} as const;
export type WorkflowMode = (typeof WorkflowMode)[keyof typeof WorkflowMode];

/** Classifies why a workflow task failed (Phase 10 spec §23) — drives `orchestrator.retry.ts`'s
 *  retry-or-not decision: only transient categories (AI_ERROR/TIMEOUT/RUNTIME_ERROR) are ever
 *  auto-retried. */
export const FailureCategory = {
  AI_ERROR: 'AI_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  FILE_CONFLICT: 'FILE_CONFLICT',
  BUILD_ERROR: 'BUILD_ERROR',
  TEST_FAILURE: 'TEST_FAILURE',
  SECURITY_ERROR: 'SECURITY_ERROR',
  TIMEOUT: 'TIMEOUT',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;
export type FailureCategory = (typeof FailureCategory)[keyof typeof FailureCategory];

/** One real-time workflow event (Phase 10 spec §19/§21) — the fixed, allowlisted shape every
 *  `orchestrator.events.ts` payload is built from, so a raw error object or env can never leak
 *  through. */
export const WorkflowEventType = {
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_PLANNED: 'workflow.planned',
  TASK_READY: 'task.ready',
  TASK_STARTED: 'task.started',
  AGENT_STARTED: 'agent.started',
  AGENT_PROGRESS: 'agent.progress',
  AGENT_COMPLETED: 'agent.completed',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_RETRYING: 'task.retrying',
  TASK_NEEDS_REVIEW: 'task.needs_review',
  WORKFLOW_PAUSED: 'workflow.paused',
  WORKFLOW_RESUMED: 'workflow.resumed',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  WORKFLOW_CANCELLED: 'workflow.cancelled',
  FIX_STARTED: 'fix.started',
  TEST_STARTED: 'test.started',
  TEST_COMPLETED: 'test.completed',
} as const;
export type WorkflowEventType = (typeof WorkflowEventType)[keyof typeof WorkflowEventType];

/** Lifecycle of one sandboxed command execution (Phase 11 spec §7) — one `SandboxSession` document
 *  per command, never a long-lived container reused across multiple commands (spec §6's own
 *  lifecycle diagram is create → run one command → destroy). */
export const SandboxStatus = {
  CREATING: 'creating',
  STARTING: 'starting',
  READY: 'ready',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
  DESTROYING: 'destroying',
  DESTROYED: 'destroyed',
} as const;
export type SandboxStatus = (typeof SandboxStatus)[keyof typeof SandboxStatus];

/** Real-time terminal/sandbox event types (Phase 11 spec §13/§65) — same allowlisted-payload
 *  discipline as `WorkflowEventType`: never a raw error object, env, or secret. */
export const SandboxEventType = {
  SANDBOX_CREATED: 'sandbox:created',
  SANDBOX_READY: 'sandbox:ready',
  TERMINAL_STARTED: 'terminal:started',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_ERROR: 'terminal:error',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_TIMEOUT: 'terminal:timeout',
  TERMINAL_CANCELLED: 'terminal:cancelled',
  SANDBOX_STOPPED: 'sandbox:stopped',
  SANDBOX_DESTROYED: 'sandbox:destroyed',
} as const;
export type SandboxEventType = (typeof SandboxEventType)[keyof typeof SandboxEventType];

/** Lifecycle of a user's account-level GitHub OAuth connection (Phase 12 spec §5). Distinct from a
 *  per-project `GitSyncStatus` — a user connects GitHub once, then connects/imports many projects
 *  against that single connection. */
export const GitHubConnectionStatus = {
  CONNECTED: 'connected',
  REVOKED: 'revoked',
  ERROR: 'error',
} as const;
export type GitHubConnectionStatus = (typeof GitHubConnectionStatus)[keyof typeof GitHubConnectionStatus];

/** Per-project Git sync state (Phase 12 spec §6) — surfaced in the Source Control panel's status
 *  badge, same spirit as `WorkspaceStatus`. */
export const GitSyncStatus = {
  NOT_CONNECTED: 'not_connected',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  AHEAD: 'ahead',
  BEHIND: 'behind',
  DIVERGED: 'diverged',
  CONFLICT: 'conflict',
  ERROR: 'error',
} as const;
export type GitSyncStatus = (typeof GitSyncStatus)[keyof typeof GitSyncStatus];

/** One file's status in `git status --porcelain` output (Phase 12 spec §10/§21), mapped from git's
 *  own letter codes into a name the Source Control panel can render directly. */
export const GitFileStatus = {
  MODIFIED: 'modified',
  ADDED: 'added',
  DELETED: 'deleted',
  RENAMED: 'renamed',
  UNTRACKED: 'untracked',
  CONFLICTED: 'conflicted',
} as const;
export type GitFileStatus = (typeof GitFileStatus)[keyof typeof GitFileStatus];

/** GitHub Pull Request state, as GitHub's own REST API reports it (Phase 12 spec §19/§20) — never
 *  fabricated, always read straight off the Octokit response. */
export const PullRequestState = {
  OPEN: 'open',
  CLOSED: 'closed',
  MERGED: 'merged',
} as const;
export type PullRequestState = (typeof PullRequestState)[keyof typeof PullRequestState];

/** Real-time GitHub/Git event types (Phase 12 spec §34) — same allowlisted-payload discipline as
 *  `WorkflowEventType`/`SandboxEventType`: never a raw error object, env, or token. Streamed over
 *  the project-scoped SSE channel in `github.events.ts`. */
export const GitHubEventType = {
  CONNECTING: 'github:connecting',
  CONNECTED: 'github:connected',
  DISCONNECTED: 'github:disconnected',
  IMPORT_START: 'github:import:start',
  IMPORT_PROGRESS: 'github:import:progress',
  IMPORT_COMPLETE: 'github:import:complete',
  SYNC_START: 'github:sync:start',
  SYNC_COMPLETE: 'github:sync:complete',
  PUSH_START: 'github:push:start',
  PUSH_COMPLETE: 'github:push:complete',
  PULL_START: 'github:pull:start',
  PULL_COMPLETE: 'github:pull:complete',
  FETCH_START: 'github:fetch:start',
  FETCH_COMPLETE: 'github:fetch:complete',
  COMMIT_COMPLETE: 'github:commit:complete',
  BRANCH_CREATED: 'github:branch:created',
  BRANCH_SWITCHED: 'github:branch:switched',
  PR_CREATED: 'github:pr:created',
  CONFLICT: 'github:conflict',
  ERROR: 'github:error',
} as const;
export type GitHubEventType = (typeof GitHubEventType)[keyof typeof GitHubEventType];
