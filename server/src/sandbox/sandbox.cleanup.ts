import Docker from 'dockerode';
import { sandboxConfig } from './sandbox.config';
import { logger } from '../utils/logger';

/** A container older than this without having been cleaned up by its own `runInContainer` `finally`
 *  block is almost certainly orphaned by a server crash/restart mid-run, not still legitimately
 *  running — `SANDBOX_TIMEOUT_MS` already caps any single run, so anything older than a few multiples
 *  of that is safe to reclaim. */
const ORPHAN_AGE_MS = sandboxConfig.TIMEOUT_MS * 3;

async function sweepOnce(docker: Docker): Promise<void> {
  const containers = await docker
    .listContainers({ all: true, filters: JSON.stringify({ label: [`${sandboxConfig.CONTAINER_LABEL}=true`] }) })
    .catch((err) => {
      logger.error('sandbox.cleanup.list_failed', { error: err instanceof Error ? err.message : err });
      return [] as Docker.ContainerInfo[];
    });

  const now = Date.now();

  for (const info of containers) {
    const createdAtMs = info.Created * 1000;
    if (now - createdAtMs < ORPHAN_AGE_MS) continue;

    logger.info('sandbox.cleanup.orphan_found', { containerId: info.Id, createdAt: new Date(createdAtMs).toISOString() });

    await docker
      .getContainer(info.Id)
      .remove({ force: true })
      .catch((err) => {
        logger.error('sandbox.cleanup.orphan_remove_failed', {
          containerId: info.Id,
          error: err instanceof Error ? err.message : err,
        });
      });
  }
}

let sweepInterval: ReturnType<typeof setInterval> | null = null;

/** Periodic orphan cleanup (spec §52/§53) — catches anything a crash, an unhandled rejection, or a
 *  server restart mid-run left behind, on top of the guaranteed per-run cleanup every
 *  `runInContainer` call already does in its own `finally`. Idempotent to call more than once. */
export function startOrphanSweep(docker: Docker): void {
  if (sweepInterval) return;

  sweepInterval = setInterval(() => {
    void sweepOnce(docker);
  }, sandboxConfig.ORPHAN_SWEEP_INTERVAL_MS);

  // Never let a background sweep keep the Node process alive on its own.
  sweepInterval.unref?.();
}

export function stopOrphanSweep(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}
