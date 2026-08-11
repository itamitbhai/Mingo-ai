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
