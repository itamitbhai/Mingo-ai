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
  TestResultStatus,
  TestRunStatus,
  TestType,
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
 *  Frontend/Backend/Database Agent task boards (spec §54, Phase 7 §38, Phase 8 §77) render. */
export interface ITaskBoardItem extends IPlanTask {
  executionStatus: TaskExecutionStatus;
  latestGenerationId?: string;
  error?: string;
  /** Whether the Frontend Agent can actually run this task — `false` for backend/database/testing/
   *  etc. tasks, which belong to other agents and will always be rejected if run. */
  isFrontendTask: boolean;
  /** Whether the Backend Agent can actually run this task (Phase 7) — `false` for frontend/
   *  database/testing/etc. tasks. */
  isBackendTask: boolean;
  /** Whether the Database Agent can actually run this task (Phase 8) — `false` for frontend/
   *  backend/testing/etc. tasks. */
  isDatabaseTask: boolean;
  /** Whether the Testing Agent can actually run this task (Phase 9) — `false` for frontend/
   *  backend/database/etc. tasks. */
  isTestingTask: boolean;
  /** Human-readable owner when none of `isFrontendTask`/`isBackendTask`/`isDatabaseTask`/
   *  `isTestingTask` is true, e.g. "Deployment Agent". */
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

/** The Backend Agent (Phase 7) proposes the exact same create/update/delete/rename/move file
 *  operation shape as the Frontend Agent — kept as its own name so backend code reads clearly as
 *  "AI-proposed backend operation", not "raw batch op" or a frontend-specific type. */
export type IBackendOperation = IFrontendOperation;

/** The Database Agent (Phase 8) proposes the same file operation shape too — a Mongoose model file
 *  is still just a create/update/delete/rename/move on a path. */
export type IDatabaseOperation = IFrontendOperation;

export interface IDependencyRequest {
  name: string;
  version?: string;
  reason: string;
}

/** Structured API contract metadata the Backend Agent emits for every endpoint it creates or
 *  changes (Phase 7 spec §25/§51) — consumable later by the Frontend Agent, a Testing Agent, or a
 *  Documentation Agent without re-parsing generated source. */
export interface IApiContract {
  method: string;
  path: string;
  authentication: boolean;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  errors?: string[];
}

/** One Mongoose field's structural metadata (Phase 8 spec §14/§27) — a short shape summary, not a
 *  full Mongoose SchemaDefinition. */
export interface IDatabaseFieldContract {
  type: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  /** The referenced model name, for an ObjectId ref field (spec §16). */
  ref?: string;
  unique?: boolean;
}

export interface IDatabaseIndexContract {
  fields: Record<string, 1 | -1>;
  unique?: boolean;
  /** Why this index exists (spec §17) — every generated index must be justified, not just listed. */
  reason?: string;
}

/** Structured database schema metadata the Database Agent emits for every model it creates or
 *  changes (Phase 8 spec §27/§68) — one entry per Mongoose model, consumable later by the Backend
 *  Agent, a Testing Agent, or a Documentation Agent without re-parsing generated source. */
export interface IDatabaseSchemaContract {
  model: string;
  collection: string;
  fields: Record<string, IDatabaseFieldContract>;
  indexes: IDatabaseIndexContract[];
}

export type DatabaseChangeType = 'model' | 'schema' | 'index' | 'relation' | 'seed' | 'validation';

/** A single human-readable change-log entry for the "Database Changes" preview (spec §32/§56) —
 *  lighter-weight than `IDatabaseSchemaContract`, one entry per distinct change rather than one per
 *  whole model. */
export interface IDatabaseChange {
  type: DatabaseChangeType;
  model: string;
  fields?: Record<string, unknown>;
  reason?: string;
}

export type AgentType = 'frontend' | 'backend' | 'database' | 'testing';

/** One test suite the Testing Agent plans to generate (Phase 9 spec §24/§64) — shown in the UI
 *  before generation, then stored on the resulting `IAgentGeneration.testPlan` for the record. */
export interface ITestSuitePlan {
  name: string;
  type: TestType;
  priority: TaskPriority;
  tests: string[];
}

export interface IAgentGeneration {
  id: string;
  project: string;
  plan: string;
  taskId: string;
  agentType: AgentType;
  version: number;
  status: AgentGenerationStatus;
  operations: IFrontendOperation[];
  dependencyRequests: IDependencyRequest[];
  apiContracts?: IApiContract[];
  /** Database Agent only (Phase 8 spec §27/§68). */
  schemaContracts?: IDatabaseSchemaContract[];
  /** Database Agent only (Phase 8 spec §32/§56) — the lighter change-log shown in the preview
   *  alongside the file diff. */
  databaseChanges?: IDatabaseChange[];
  /** Testing Agent only (Phase 9 spec §24/§64) — the structured test plan behind this generation's
   *  proposed test files. */
  testPlan?: ITestSuitePlan[];
  /** Populated by the Backend Agent (an endpoint outside the Planner's approved API surface) or the
   *  Database Agent (a schema missing a field the plan or an implemented backend contract
   *  requires) — never a blocking error, always shown to the user in the diff review. */
  contractWarnings?: string[];
  notes?: string;
  feedback?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 9 — Testing Agent (TestRun)
// ---------------------------------------------------------------------------

/** One executed test's real outcome (Phase 9 spec §34) — every field here traces back to either a
 *  parsed test-runner reporter file or, for `error`/`stack`, the runner's own captured output. Never
 *  fabricated when a run can't be parsed in detail (see `ITestRun.resultsTruncated`/status instead). */
export interface ITestResult {
  suite: string;
  test: string;
  status: TestResultStatus;
  duration?: number;
  error?: string;
  stack?: string;
  file?: string;
  line?: number;
  expected?: string;
  actual?: string;
}

export interface ITestRunSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs: number;
}

/** Only ever present when a coverage reporter actually produced `coverage-summary.json` — never
 *  displayed or estimated otherwise (spec §26/§36). */
export interface ICoverageSummary {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export type ITestRunScope = 'all' | 'failed' | TestType | { file: string };

export interface ITestRun {
  id: string;
  project: string;
  plan: string;
  taskId: string;
  generationId?: string;
  status: TestRunStatus;
  scope: ITestRunScope;
  command?: string;
  summary?: ITestRunSummary;
  results: ITestResult[];
  coverage?: ICoverageSummary;
  logs: { stdout: string; stderr: string; truncated: boolean };
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** AI failure analysis for one failing `ITestResult` (Phase 9 spec §38/§39) — `confidence` is the
 *  concrete mechanism for "do not claim certainty if evidence is insufficient": the UI must render it,
 *  not hide it. */
export interface ITestFailureAnalysis {
  summary: string;
  rootCause: string;
  affectedFile?: string;
  why: string;
  recommendedFix: string;
  confidence: 'low' | 'medium' | 'high';
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
