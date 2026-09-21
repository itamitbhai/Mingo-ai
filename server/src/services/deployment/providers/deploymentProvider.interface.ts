import { DeploymentOption } from 'shared';

export interface ProviderDeployParams {
  /** Stable, deterministic name derived from `projectId`+`environment` — reused across redeploys so
   *  the provider updates the same service rather than creating a new one every time. */
  serviceName: string;
  isStaticSite: boolean;
  repoUrl: string;
  branch: string;
  rootDirectory?: string;
  buildCommand: string;
  startCommand?: string;
  outputDirectory?: string;
  healthCheckPath?: string;
  envVars: { key: string; value: string }[];
  /** Set only for a rollback — pins the deploy to a specific past commit instead of the branch head. */
  commitId?: string;
}

export interface ProviderDeployHandle {
  providerServiceId: string;
  providerDeployId: string;
  commitId?: string;
}

export type ProviderDeployPhase = 'queued' | 'in_progress' | 'live' | 'failed' | 'cancelled';

export interface ProviderDeployStatus {
  phase: ProviderDeployPhase;
  /** The provider's own literal status string (e.g. Render's `"build_in_progress"`) — surfaced in
   *  logs verbatim rather than lossily mapped, so a real failure reason is never hidden. */
  rawStatus: string;
  commitId?: string;
}

/**
 * Every deployment provider Mingo supports implements this (Phase 13 spec §3/§35) — no frontend or
 * pipeline code is ever provider-specific; `services/deployment/deployment.service.ts` only ever
 * talks to this interface, resolved via `providers/index.ts`'s `getProvider()`.
 */
export interface DeploymentProvider {
  readonly name: DeploymentOption;
  /** True only when real credentials are present — `deployment.service.ts` checks this before ever
   *  starting a pipeline run, so an unconfigured provider fails fast with a clear error instead of
   *  burning a sandbox build first (spec §43 — never fake a deployment). */
  isConfigured(): boolean;
  deploy(params: ProviderDeployParams): Promise<ProviderDeployHandle>;
  getDeploymentStatus(handle: ProviderDeployHandle): Promise<ProviderDeployStatus>;
  cancelDeployment(handle: ProviderDeployHandle): Promise<void>;
  getLiveUrl(providerServiceId: string): Promise<string | undefined>;
}
