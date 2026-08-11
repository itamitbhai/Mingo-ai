import {
  ActivityType,
  AgentGenerationStatus,
  ArchitectureNodeType,
  AuthOption,
  BackendStack,
  BatchOperationType,
  DatabaseOption,
  DatabaseRelationType,
  DeploymentOption,
  DeploymentStatus,
  FileChangeType,
  FileEntryType,
  FrontendOperationType,
  FrontendStack,
  LockType,
  MessageRole,
  MessageStatus,
  NonFunctionalCategory,
  PlanType,
  ProjectPlanStatus,
  ProjectStatus,
  RecommendedAgent,
  RiskSeverity,
  StylingOption,
  TaskComplexity,
  TaskExecutionStatus,
  TaskPriority,
  TaskType,
  TechSource,
  Theme,
  WorkspaceActivityAction,
  WorkspaceStatus,
} from './enums';

export interface IUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  workspace: string;
  plan: PlanType;
  createdAt: string;
  updatedAt: string;
}

export interface ITechStack {
  frontend: FrontendStack;
  backend: BackendStack;
  database: DatabaseOption;
  authentication: AuthOption;
  styling: StylingOption;
  deployment: DeploymentOption;
}

export interface IProject extends ITechStack {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  owner: string;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IWorkspace {
  id: string;
  name: string;
  slug: string;
  owner: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

export interface INotificationPreferences {
  productUpdates: boolean;
  securityAlerts: boolean;
  projectActivity: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

export interface ISecurityPreferences {
  twoFactorEnabled: boolean;
  lastPasswordChange?: string;
}

export interface ISettings {
  id: string;
  user: string;
  theme: Theme;
  notifications: INotificationPreferences;
  security: ISecurityPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface IActivity {
  id: string;
  user: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IDeployment {
  id: string;
  project: string;
  provider: DeploymentOption;
  status: DeploymentStatus;
  url?: string;
  commitMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMessageTokens {
  input: number | null;
  output: number | null;
  total: number | null;
}

export interface IConversation {
  id: string;
  project: string;
  owner: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  metadata?: Record<string, unknown>;
}

export interface IMessage {
  id: string;
  conversation: string;
  project: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  provider?: string;
  modelName?: string;
  tokens: IMessageTokens;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export type UsagePurpose = 'chat' | 'planner';

export interface IUsage {
  id: string;
  user: string;
  project: string;
  conversation?: string;
  modelName: string;
  purpose: UsagePurpose;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
}

export interface IProjectFile {
  id: string;
  project: string;
  owner: string;
  name: string;
  path: string;
  type: FileEntryType;
  language?: string;
  mimeType?: string;
  isBinary?: boolean;
  checksum?: string;
  parentPath: string | null;
  size: number;
  version: number;
  dependencies?: string[];
  lastAnalyzedAt?: string;
  analysisStatus?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface IProjectFileWithContent extends IProjectFile {
  content: string;
}

export interface IFileTreeNode extends IProjectFile {
  children?: IFileTreeNode[];
}

export interface IProjectWorkspace {
  id: string;
  project: string;
  owner: string;
  rootPath: string;
  status: WorkspaceStatus;
  activeVersion: number;
  lastOpenedAt?: string;
  lastModifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface IProjectFileVersion {
  id: string;
  file: string;
  project: string;
  owner: string;
  version: number;
  content: string;
  checksum: string;
  changedBy: string;
  changeType: FileChangeType;
  changeSummary?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/** The shape returned by the versions *list* endpoint — content is omitted server-side to keep
 *  history listings cheap; fetch a single version (`getVersion`) to see its content. */
export type IProjectFileVersionSummary = Omit<IProjectFileVersion, 'content'>;

export interface IWorkspaceSnapshotEntry {
  file: string;
  path: string;
  type: FileEntryType;
  version: number;
  checksum: string;
}

export interface IWorkspaceSnapshot {
  id: string;
  project: string;
  owner: string;
  name: string;
  description?: string;
  version: number;
  fileCount: number;
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface IWorkspaceActivity {
  id: string;
  project: string;
  user: string;
  file?: string;
  action: WorkspaceActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IWorkspaceManifest {
  projectId: string;
  framework: string;
  language: string;
  packageManager: string;
  files: number;
  folders: number;
  entryPoints: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface IWorkspaceLock {
  id: string;
  project: string;
  file: string;
  lockedBy: string;
  lockType: LockType;
  expiresAt: string;
  createdAt: string;
}

export interface IBatchOperation {
  type: BatchOperationType;
  path: string;
  destinationPath?: string;
  newName?: string;
  content?: string;
}

export interface IBatchOperationOutcome extends IBatchOperation {
  status: 'created' | 'updated' | 'deleted' | 'renamed' | 'moved';
  file?: IProjectFile;
}

export interface IBatchOperationResult {
  applied: number;
  operations: IBatchOperationOutcome[];
}

export interface IOperationPreviewEntry extends IBatchOperation {
  action: 'CREATE' | 'MODIFY' | 'DELETE';
  existing?: IProjectFile;
}

export interface IOperationPreviewResult {
  valid: boolean;
  operations: IOperationPreviewEntry[];
  warnings: string[];
  errors: string[];
  conflicts: string[];
}

// ---------------------------------------------------------------------------
// Phase 5 — Planner Agent (ProjectPlan)
// ---------------------------------------------------------------------------

export interface IPlanRequirements {
  explicit: string[];
  inferred: string[];
  missing: string[];
}

export interface IPlanStackEntry {
  name: string;
  source: TechSource;
  reason?: string;
}

export interface IPlanStack {
  frontend?: IPlanStackEntry;
  backend?: IPlanStackEntry;
  database?: IPlanStackEntry;
  authentication?: IPlanStackEntry;
  payments?: IPlanStackEntry;
  storage?: IPlanStackEntry;
  styling?: IPlanStackEntry;
  testing?: IPlanStackEntry;
  deployment?: IPlanStackEntry;
}

export interface IArchitectureNode {
  id: string;
  label: string;
  type?: ArchitectureNodeType;
}

export interface IArchitectureEdge {
  from: string;
  to: string;
  label?: string;
}

export interface IPlanArchitecture {
  description: string;
  nodes: IArchitectureNode[];
  edges: IArchitectureEdge[];
}

export interface IPlanFeature {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  complexity: TaskComplexity;
  requirements: string[];
}

export interface IPlanDatabaseField {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface IPlanDatabaseEntity {
  name: string;
  fields: IPlanDatabaseField[];
}

export interface IPlanDatabaseRelationship {
  from: string;
  to: string;
  type: DatabaseRelationType;
  description?: string;
}

export interface IPlanDatabase {
  entities: IPlanDatabaseEntity[];
  relationships: IPlanDatabaseRelationship[];
}

export interface IPlanApiEndpoint {
  method: string;
  path: string;
  purpose: string;
  authRequired: boolean;
  requestSummary?: string;
  responseSummary?: string;
  relatedFeature?: string;
}

export interface IPlanPage {
  name: string;
  path?: string;
  description?: string;
}

export interface IPlanComponent {
  name: string;
  description?: string;
}

export interface IPlanFrontend {
  pages: IPlanPage[];
  components: IPlanComponent[];
  hooks: IPlanComponent[];
  state: string[];
}

export interface IPlanFileEntry {
  path: string;
  type: FileEntryType;
  description?: string;
  exists?: boolean;
}

export interface IPlanTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  complexity: TaskComplexity;
  dependencies: string[];
  affectedFiles: string[];
  acceptanceCriteria: string[];
  recommendedAgent?: RecommendedAgent;
}

export interface IPlanRisk {
  severity: RiskSeverity;
  description: string;
  mitigation: string;
}

export interface IPlanSecurityRequirement {
  requirement: string;
  description?: string;
}

export interface IPlanNonFunctionalRequirement {
  category: NonFunctionalCategory;
  description: string;
}

export interface IPlanConflict {
  description: string;
  optionsDetected: string[];
}

export interface IProjectPlan {
  id: string;
  project: string;
  owner: string;
  conversation?: string;
  version: number;
  status: ProjectPlanStatus;
  prompt: string;
  error?: string;
  summary?: string;
  projectType?: string;
  requirements?: IPlanRequirements;
  stack?: IPlanStack;
  architecture?: IPlanArchitecture;
  features?: IPlanFeature[];
  database?: IPlanDatabase;
  api?: IPlanApiEndpoint[];
  frontend?: IPlanFrontend;
  files?: IPlanFileEntry[];
  tasks?: IPlanTask[];
  executionOrder?: string[];
  risks?: IPlanRisk[];
  assumptions?: string[];
  security?: IPlanSecurityRequirement[];
  nonFunctionalRequirements?: IPlanNonFunctionalRequirement[];
  conflicts?: IPlanConflict[];
  createdAt: string;
  updatedAt: string;
}

export interface IPlanDiffChange<T> {
  before: T;
  after: T;
}

export interface IPlanDiff {
  featuresAdded: IPlanFeature[];
  featuresRemoved: IPlanFeature[];
  featuresChanged: IPlanDiffChange<IPlanFeature>[];
  tasksAdded: IPlanTask[];
  tasksRemoved: IPlanTask[];
  tasksChanged: IPlanDiffChange<IPlanTask>[];
  stackChanged: Array<{ key: string; before?: IPlanStackEntry; after?: IPlanStackEntry }>;
}

// ---------------------------------------------------------------------------
// Phase 6 — Frontend Agent (TaskExecution / AgentGeneration)
// ---------------------------------------------------------------------------

export interface ITaskExecution {
  id: string;
  project: string;
  plan: string;
  taskId: string;
  status: TaskExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  latestGenerationId?: string;
  createdAt: string;
  updatedAt: string;
}

/** A task from `IProjectPlan.tasks` merged with its live `ITaskExecution` status — what the
 *  Frontend Agent task board (spec §54) renders. */
export interface ITaskBoardItem extends IPlanTask {
  executionStatus: TaskExecutionStatus;
  latestGenerationId?: string;
  error?: string;
  /** Whether the Frontend Agent can actually run this task — `false` for backend/database/testing/
   *  etc. tasks, which belong to future agents and will always be rejected if run. */
  isFrontendTask: boolean;
  /** Human-readable owner when `isFrontendTask` is false, e.g. "Backend Agent". */
  owningAgent?: string;
}

export interface IFrontendOperation {
  type: FrontendOperationType;
  path: string;
  reason: string;
  content?: string;
  originalContent?: string;
  newName?: string;
  destinationPath?: string;
}

export interface IDependencyRequest {
  name: string;
  version?: string;
  reason: string;
}

export interface IAgentGeneration {
  id: string;
  project: string;
  plan: string;
  taskId: string;
  agentType: 'frontend';
  version: number;
  status: AgentGenerationStatus;
  operations: IFrontendOperation[];
  dependencyRequests: IDependencyRequest[];
  notes?: string;
  feedback?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type AutopilotTaskOutcome = 'completed' | 'skipped' | 'failed' | 'not_attempted';

/** One task's result from an end-to-end Autopilot run — a one-shot run outcome, distinct from
 *  `ITaskBoardItem` (live/persisted task-board state). */
export interface IAutopilotTaskResult {
  taskId: string;
  title: string;
  outcome: AutopilotTaskOutcome;
  generationId?: string;
  reason?: string;
  error?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}
