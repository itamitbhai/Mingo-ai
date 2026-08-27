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

export const DeploymentStatus = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

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
