import path from 'node:path';
import Docker from 'dockerode';
import { sandboxConfig } from './sandbox.config';
import { logger } from '../utils/logger';

const DOCKERFILE_DIR = path.join(__dirname, 'docker');

let ensureImagePromise: Promise<void> | null = null;

async function imageExists(docker: Docker, tag: string): Promise<boolean> {
  const images = await docker.listImages({ filters: JSON.stringify({ reference: [tag] }) });
  return images.length > 0;
}

/**
 * Builds the pinned sandbox image (spec §61/§62) if it isn't already present locally — lazy, on first
 * use, so running Mingo never requires a manual `docker build` step. Never uses `latest`; the tag
 * (`sandboxConfig.IMAGE_TAG`, e.g. `mingo-sandbox:node22-v1`) is versioned in config, not computed.
 * Memoized so concurrent first-callers don't race each other into building it twice.
 */
export async function ensureImage(docker: Docker): Promise<void> {
  if (!ensureImagePromise) {
    ensureImagePromise = buildIfMissing(docker).catch((err) => {
      ensureImagePromise = null; // allow a retry on the next call if this attempt failed
      throw err;
    });
  }
  return ensureImagePromise;
}

async function buildIfMissing(docker: Docker): Promise<void> {
  const tag = sandboxConfig.IMAGE_TAG;

  if (await imageExists(docker, tag)) {
    return;
  }

  logger.info('sandbox.image.building', { tag, dockerfileDir: DOCKERFILE_DIR });

  const stream = await docker.buildImage(
    { context: DOCKERFILE_DIR, src: ['Dockerfile'] },
    { t: tag }
  );

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: Error | null, output: unknown[]) => {
        if (err) {
          reject(err);
          return;
        }
        const lastEntry = output[output.length - 1] as { error?: string } | undefined;
        if (lastEntry?.error) {
          reject(new Error(lastEntry.error));
          return;
        }
        resolve();
      }
    );
  });

  logger.info('sandbox.image.built', { tag });
}
