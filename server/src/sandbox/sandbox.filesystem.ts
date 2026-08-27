import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import * as materializer from '../services/sandbox/materializer.service';
import { sandboxConfig } from './sandbox.config';

export interface SandboxWorkspace {
  dir: string;
  cleanup: () => Promise<void>;
}

/**
 * Prepares the host directory a sandbox container bind-mounts as `/workspace` (spec §17/§18) — reuses
 * Phase 9's `materializer.service.materializeWorkspace` unchanged (it already walks the Phase 4 Virtual
 * Filesystem, skips forbidden paths, and caps the snapshot at 50MB) since Docker bind mounts need a
 * real host path regardless of which process ends up reading/writing it.
 */
export async function prepareSandboxWorkspace(owner: Types.ObjectId, projectId: string): Promise<SandboxWorkspace> {
  const materialized = await materializer.materializeWorkspace(owner, projectId);
  return { dir: materialized.dir, cleanup: materialized.cleanup };
}

async function directorySizeBytes(dir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySizeBytes(entryPath);
    } else if (entry.isFile()) {
      total += await stat(entryPath).then((info) => info.size, () => 0);
    }
  }

  return total;
}

/**
 * The practical, cross-platform "disk limit" (spec §21/§25): Docker Desktop's default storage driver
 * doesn't support a reliable `--storage-opt size=` quota, so this checks the bind-mounted host
 * directory's real size after install (and can be called periodically during a long-running command)
 * instead of relying on a kernel-enforced quota. An approximation, not a guarantee — documented as
 * such rather than silently claiming more than it delivers.
 */
export async function assertWithinDiskLimit(dir: string): Promise<void> {
  const sizeMb = (await directorySizeBytes(dir)) / (1024 * 1024);
  if (sizeMb > sandboxConfig.DISK_LIMIT_MB) {
    throw new Error(`Sandbox workspace exceeded the disk limit (${Math.round(sizeMb)}MB > ${sandboxConfig.DISK_LIMIT_MB}MB).`);
  }
}
