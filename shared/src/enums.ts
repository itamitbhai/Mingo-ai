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
