import Docker from 'dockerode';
import { Types } from 'mongoose';
import { SandboxEventType, SandboxStatus } from 'shared';
import { SandboxSessionDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { sandboxConfig } from './sandbox.config';
import { assertWithinDiskLimit, prepareSandboxWorkspace } from './sandbox.filesystem';
import { publish, publishOutput } from './sandbox.events';
import { nodeModulesVolumeName, runInContainer } from './sandbox.executor';
import { ensureImage } from './sandbox.image';
import { buildLogsField } from './sandbox.logs';
import { ensureSandboxNetwork } from './sandbox.network';
import { SandboxCommand, SandboxNetworkMode } from './sandbox.types';

const docker = new Docker();
let dockerAvailable: boolean | null = null;

/** Never crashes the app if Docker isn't reachable (spec §66/§67) — every sandbox-creating call
 *  surfaces this as a clear, typed error instead. Memoized `true` once confirmed (Docker doesn't
 *  usually disappear mid-run); re-checked every call while still `false`/unknown so a Docker Desktop
 *  restart is picked back up without restarting Mingo. */
export async function assertDockerAvailable(): Promise<void> {
  if (dockerAvailable === true) return;

  try {
    await docker.ping();
    dockerAvailable = true;
  } catch (err) {
    dockerAvailable = false;
    logger.error('sandbox.manager.docker_unavailable', { error: err instanceof Error ? err.message : err });
    throw new ApiError(503, 'Sandbox runtime is currently unavailable.');
  }
}

export function getDockerClient(): Docker {
  return docker;
}

/**
 * A brand-new named volume is root-owned by default — the sandbox's unprivileged `10001:10001` user
 * (`sandbox.executor.ts`'s `runInContainer`) can't write into it as-is, so `npm install` would fail
 * with EACCES the first time a project uses it. Fixes ownership once, via a short-lived root
 * container against the same image; a no-op (fast, harmless) on every call after the first since the
 * volume is already correctly owned. `docker.createVolume` itself is idempotent — it returns the
 * existing volume rather than erroring if the name is already taken.
 */
export async function ensureNodeModulesVolume(projectId: string): Promise<void> {
  const name = nodeModulesVolumeName(projectId);
  await docker.createVolume({ Name: name });

  const initContainer = await docker.createContainer({
    Image: sandboxConfig.IMAGE_TAG,
    Cmd: ['chown', '-R', '10001:10001', '/target'],
    User: '0:0',
    HostConfig: { Binds: [`${name}:/target`] },
  });

  try {
    await initContainer.start();
    await initContainer.wait();
  } finally {
    await initContainer.remove({ force: true }).catch(() => undefined);
  }
}

/** Best-effort — called when a project is deleted so its persistent `node_modules` volume (see
 *  `sandbox.executor.ts`'s `nodeModulesVolumeName`) doesn't linger forever. Never throws: a project
 *  that never ran a sandbox command has no such volume, and Docker being unavailable shouldn't block
 *  deleting the project itself. */
export async function deleteProjectSandboxVolume(projectId: string): Promise<void> {
  await docker
    .getVolume(nodeModulesVolumeName(projectId))
    .remove()
    .catch(() => undefined);
}

interface ExecuteSandboxParams {
  session: SandboxSessionDocument;
  owner: Types.ObjectId;
  projectId: string;
  command: SandboxCommand;
  networkMode: SandboxNetworkMode;
  timeoutMs: number;
  signal: AbortSignal;
}

/**
 * Top-level orchestration (Phase 11 spec §6): ensure the image/network exist, materialize the
 * project into a host temp dir (Phase 9's materializer, reused), run the command in a fresh
 * container, persist the real result, always clean up — even on error, timeout, or cancellation.
 */
export async function executeSandbox(params: ExecuteSandboxParams): Promise<SandboxSessionDocument> {
  const { session, owner, projectId, command, networkMode, timeoutMs, signal } = params;
  const sandboxId = session.id as string;

  let workspace: Awaited<ReturnType<typeof prepareSandboxWorkspace>> | null = null;

  try {
    await assertDockerAvailable();
    await ensureImage(docker);
    await ensureNodeModulesVolume(projectId);
    if (networkMode === 'install') await ensureSandboxNetwork(docker);

    session.status = SandboxStatus.STARTING;
    await session.save();
    publish(sandboxId, { type: SandboxEventType.SANDBOX_CREATED, message: 'Preparing sandbox workspace…' });

    workspace = await prepareSandboxWorkspace(owner, projectId);

    session.status = SandboxStatus.READY;
    await session.save();
    publish(sandboxId, { type: SandboxEventType.SANDBOX_READY, message: 'Sandbox ready.' });

    session.status = SandboxStatus.RUNNING;
    session.startedAt = new Date();
    await session.save();
    publish(sandboxId, {
      type: SandboxEventType.TERMINAL_STARTED,
      message: `Running "${[command.command, ...command.args].join(' ')}"`,
    });

    const result = await runInContainer(docker, {
      command: command.command,
      args: command.args,
      workspaceDir: workspace.dir,
      projectId,
      networkMode,
      timeoutMs,
      sandboxId,
      signal,
      onOutput: (chunk, stream) => publishOutput(sandboxId, chunk, stream),
    });

    await assertWithinDiskLimit(workspace.dir).catch((err) => {
      // A late-discovered oversized workspace doesn't retroactively invalidate a command that
      // already completed successfully — logged, not treated as a hard failure of this run.
      logger.warn('sandbox.manager.disk_limit_note', {
        sandboxId,
        error: err instanceof Error ? err.message : err,
      });
    });

    session.containerId = result.containerId;
    session.exitCode = result.exitCode ?? undefined;
    session.logs = buildLogsField(result.stdout, result.stderr, result.truncated);
    session.completedAt = new Date();

    if (result.cancelled) {
      session.status = SandboxStatus.CANCELLED;
      publish(sandboxId, { type: SandboxEventType.TERMINAL_CANCELLED, message: 'Sandbox cancelled.' });
    } else if (result.timedOut) {
      session.status = SandboxStatus.TIMEOUT;
      publish(sandboxId, { type: SandboxEventType.TERMINAL_TIMEOUT, message: 'Sandbox timed out.' });
    } else {
      session.status = result.exitCode === 0 ? SandboxStatus.COMPLETED : SandboxStatus.FAILED;
      publish(sandboxId, {
        type: SandboxEventType.TERMINAL_EXIT,
        message: `Exited with code ${result.exitCode}`,
        exitCode: result.exitCode ?? undefined,
      });
    }

    await session.save();
    publish(sandboxId, { type: SandboxEventType.SANDBOX_DESTROYED, message: 'Sandbox cleaned up.' });

    return session;
  } catch (err) {
    session.status = SandboxStatus.FAILED;
    session.error = (err instanceof Error ? err.message : 'Sandbox execution failed').slice(0, 1000);
    session.completedAt = new Date();
    await session.save().catch(() => undefined);
    // TERMINAL_EXIT, not TERMINAL_ERROR — the latter is reserved for live stderr *chunks*
    // (`publishOutput`), which the SSE controller must never treat as a stream-closing signal (a
    // program writing one line to stderr, e.g. an npm warning, is completely normal mid-run). This is
    // the terminal signal for "the run is over, unsuccessfully, without ever producing a real exit
    // code" — the client checks `GET /sandbox/:id`'s `error` field for why.
    publish(sandboxId, {
      type: SandboxEventType.TERMINAL_EXIT,
      message: session.error ?? 'Sandbox execution failed.',
    });
    throw err;
  } finally {
    await workspace?.cleanup();
  }
}
