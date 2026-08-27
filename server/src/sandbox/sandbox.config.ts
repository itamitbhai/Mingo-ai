import { env } from '../config/env';

/**
 * Single source for every Sandbox limit (Phase 11) — mirrors `orchestratorConfig`'s pattern. Unlike
 * every agent's `*.config.ts`, there's no `MODEL` here: the sandbox never calls an AI provider, only
 * Docker.
 */
export const sandboxConfig = {
  IMAGE_TAG: env.SANDBOX_IMAGE_TAG,
  MEMORY_MB: env.SANDBOX_MEMORY_MB,
  TMPFS_MB: env.SANDBOX_TMPFS_MB,
  CPU_CORES: env.SANDBOX_CPU_CORES,
  PIDS_LIMIT: env.SANDBOX_PIDS_LIMIT,
  DISK_LIMIT_MB: env.SANDBOX_DISK_LIMIT_MB,
  TIMEOUT_MS: env.SANDBOX_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS: env.SANDBOX_INSTALL_TIMEOUT_MS,
  MAX_LOG_CHARS: env.SANDBOX_MAX_LOG_CHARS,
  ORPHAN_SWEEP_INTERVAL_MS: env.SANDBOX_ORPHAN_SWEEP_INTERVAL_MS,
  /** Every container this manager creates carries this label — how the orphan sweep (and a human
   *  running `docker ps`) tells a Mingo sandbox apart from an unrelated container. */
  CONTAINER_LABEL: 'mingo.sandbox',
  /** The isolated bridge network created once for the install phase only (spec §26/§27). */
  NETWORK_NAME: 'mingo-sandbox-install',
};
