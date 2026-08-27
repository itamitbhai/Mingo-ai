import Docker from 'dockerode';
import { sandboxConfig } from './sandbox.config';
import { SandboxNetworkMode } from './sandbox.types';
import { logger } from '../utils/logger';

let ensureNetworkPromise: Promise<void> | null = null;

async function networkExists(docker: Docker, name: string): Promise<boolean> {
  const networks = await docker.listNetworks({ filters: JSON.stringify({ name: [name] }) });
  return networks.some((network) => network.Name === name);
}

/**
 * Creates the one isolated bridge network used only for the install phase (spec §26/§27) — a custom
 * bridge Docker creates in its own subnet, distinct from the default bridge, with no route to the host
 * beyond what `sandbox.security.ts`'s `ExtraHosts` already blocks. Every other phase uses
 * `NetworkMode: 'none'` and never touches this at all. Idempotent/memoized like `ensureImage`.
 */
export async function ensureSandboxNetwork(docker: Docker): Promise<void> {
  if (!ensureNetworkPromise) {
    ensureNetworkPromise = createIfMissing(docker).catch((err) => {
      ensureNetworkPromise = null;
      throw err;
    });
  }
  return ensureNetworkPromise;
}

async function createIfMissing(docker: Docker): Promise<void> {
  const name = sandboxConfig.NETWORK_NAME;

  if (await networkExists(docker, name)) {
    return;
  }

  logger.info('sandbox.network.creating', { name });
  await docker.createNetwork({
    Name: name,
    Driver: 'bridge',
    Internal: false, // needs real internet egress to reach the npm registry
    Labels: { [sandboxConfig.CONTAINER_LABEL]: 'true' },
  });
  logger.info('sandbox.network.created', { name });
}

export function resolveNetworkMode(mode: SandboxNetworkMode): string {
  return mode === 'install' ? sandboxConfig.NETWORK_NAME : 'none';
}
