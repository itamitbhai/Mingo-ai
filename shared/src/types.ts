import {
  ActivityType,
  AuthOption,
  BackendStack,
  DatabaseOption,
  DeploymentOption,
  DeploymentStatus,
  FileEntryType,
  FrontendStack,
  MessageRole,
  MessageStatus,
  PlanType,
  ProjectStatus,
  StylingOption,
  Theme,
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

export interface IUsage {
  id: string;
  user: string;
  project: string;
  conversation: string;
  modelName: string;
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
  parentPath: string | null;
  size: number;
  version: number;
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
