import type {
  DeploymentEnvironment,
  DeploymentEventType,
  DeploymentOption,
  DeploymentServiceType,
  DeploymentStage,
  DeploymentStatus,
  DeploymentTrigger,
  HealthCheckStatus,
} from 'shared';

export interface IHealthCheckConfig {
  path: string;
  expectedStatus: number;
  timeoutSeconds: number;
  retries: number;
}

export interface IDeploymentConfig {
  id: string;
  project: string;
  provider: DeploymentOption;
  serviceType: DeploymentServiceType;
  environment: DeploymentEnvironment;
  branch: string;
  buildCommand: string;
  startCommand?: string;
  testCommand?: string;
  outputDirectory?: string;
  rootDirectory?: string;
  framework?: string;
  nodeVersion?: string;
  autoDeploy: boolean;
  healthCheck: IHealthCheckConfig;
  createdAt: string;
  updatedAt: string;
}

export interface IEnvironmentVariable {
  id: string;
  key: string;
  environment: DeploymentEnvironment;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface IRevealedEnvironmentVariable {
  id: string;
  key: string;
  environment: DeploymentEnvironment;
  value: string;
}

export interface IDeploymentHealthCheck {
  status: HealthCheckStatus;
  checkedAt?: string;
  statusCode?: number;
}

export interface IDeployment {
  id: string;
  project: string;
  provider: DeploymentOption;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  stage?: DeploymentStage;
  triggeredBy: DeploymentTrigger;
  pullRequestNumber?: number;
  branch: string;
  commitHash?: string;
  url?: string;
  commitMessage?: string;
  buildLogs: string;
  deploymentLogs: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  rollbackFrom?: string;
  healthCheck: IDeploymentHealthCheck;
  createdAt: string;
  updatedAt: string;
}

export interface IDeploymentStreamEvent {
  type: DeploymentEventType;
  deploymentId: string;
  message: string;
  stage?: DeploymentStage;
  chunk?: string;
  timestamp: string;
}

export interface IDeploymentReadinessCheck {
  label: string;
  passed: boolean;
  detail?: string;
  blocking: boolean;
}

export interface IDeploymentReadiness {
  ready: boolean;
  checks: IDeploymentReadinessCheck[];
}
