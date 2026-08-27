import { Writable } from 'node:stream';
import Docker from 'dockerode';
import { sandboxConfig } from './sandbox.config';
import { resolveNetworkMode } from './sandbox.network';
import { buildSandboxEnv, getSandboxExtraHosts } from './sandbox.security';
import { RunInContainerOptions, RunInContainerResult } from './sandbox.types';
import { logger } from '../utils/logger';

/** Converts a Windows host path (`C:\Users\...`) into the forward-slash form Docker Desktop's Engine
 *  API expects for a bind-mount source — the standard workaround for the ambiguity between a Windows
 *  drive-letter colon and the bind spec's own `host:container` colon separator. A no-op on POSIX. */
function toBindPath(hostPath: string): string {
  return hostPath.replace(/\\/g, '/');
}

/**
 * `materializeWorkspace` (spec §9's hermetic-per-run guarantee) deletes its temp dir — including
 * anything `npm install` wrote — the moment a single command finishes, which is correct for a
 * one-shot test run but means a real multi-command terminal session would lose every installed
 * package between commands (`npm install` succeeds, then the very next `npm run dev` fails with
 * "next: not found"). A named Docker volume mounted at `/workspace/node_modules`, keyed by project,
 * survives across commands/containers the same way a real machine's `node_modules` would, while the
 * rest of `/workspace` still refreshes from the Virtual Filesystem on every run as before.
 */
export function nodeModulesVolumeName(projectId: string): string {
  return `mingo-sandbox-nm-${projectId}`;
}

function makeCollector(maxChars: number, which: 'stdout' | 'stderr', onOutput?: RunInContainerOptions['onOutput']) {
  let buffer = '';
  let truncated = false;

  const writable = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      const text = chunk.toString('utf8');
      onOutput?.(text, which);

      if (buffer.length >= maxChars) {
        truncated = true;
      } else {
        buffer = (buffer + text).slice(0, maxChars);
        if (buffer.length >= maxChars) truncated = true;
      }
      callback();
    },
  });

  return { writable, getText: () => buffer, isTruncated: () => truncated };
}

async function forceRemove(container: Docker.Container): Promise<void> {
  await container.remove({ force: true }).catch((err) => {
    logger.error('sandbox.executor.remove_failed', { error: err instanceof Error ? err.message : err });
  });
}

/**
 * The low-level primitive (Phase 11 spec §6): create one container, run one command, stream its
 * output, wait for it to exit (or time out / be cancelled), and always remove it. Every field the
 * caller gets back traces to Docker's own `wait()`/attach stream — nothing here is simulated
 * (spec §38's "never fabricate results," carried over from the Testing Agent's sandbox).
 */
export async function runInContainer(docker: Docker, options: RunInContainerOptions): Promise<RunInContainerResult> {
  const stdout = makeCollector(sandboxConfig.MAX_LOG_CHARS, 'stdout', options.onOutput);
  const stderr = makeCollector(sandboxConfig.MAX_LOG_CHARS, 'stderr', options.onOutput);

  const workingDir = options.workingDir ? `/workspace/${options.workingDir}` : '/workspace';

  const container = await docker.createContainer({
    Image: sandboxConfig.IMAGE_TAG,
    Cmd: [options.command, ...options.args],
    WorkingDir: workingDir,
    User: '10001:10001',
    Env: Object.entries(buildSandboxEnv()).map(([key, value]) => `${key}=${value}`),
    Tty: false,
    AttachStdout: true,
    AttachStderr: true,
    Labels: { [sandboxConfig.CONTAINER_LABEL]: 'true', 'mingo.sandboxId': options.sandboxId },
    HostConfig: {
      Binds: [
        `${toBindPath(options.workspaceDir)}:/workspace`,
        `${nodeModulesVolumeName(options.projectId)}:/workspace/node_modules`,
      ],
      ReadonlyRootfs: true,
      Tmpfs: { '/tmp': `size=${sandboxConfig.TMPFS_MB}m` },
      Memory: sandboxConfig.MEMORY_MB * 1024 * 1024,
      NanoCpus: Math.round(sandboxConfig.CPU_CORES * 1_000_000_000),
      PidsLimit: sandboxConfig.PIDS_LIMIT,
      NetworkMode: resolveNetworkMode(options.networkMode),
      CapDrop: ['ALL'],
      Privileged: false,
      ExtraHosts: getSandboxExtraHosts(),
    },
  });

  let timedOut = false;
  let cancelled = false;
  let settled = false;
  const timeoutHandle = setTimeout(() => {
    if (settled) return;
    timedOut = true;
    void container.stop({ t: 5 }).catch(() => undefined);
  }, options.timeoutMs);

  const onAbort = () => {
    if (settled) return;
    cancelled = true;
    void container.stop({ t: 5 }).catch(() => undefined);
  };
  options.signal?.addEventListener('abort', onAbort);

  try {
    const attachStream = await container.attach({ stream: true, stdout: true, stderr: true });
    docker.modem.demuxStream(attachStream, stdout.writable, stderr.writable);

    await container.start();
    logger.info('sandbox.executor.started', { sandboxId: options.sandboxId, containerId: container.id });

    const waitResult = (await container.wait()) as { StatusCode: number };
    settled = true;
    clearTimeout(timeoutHandle);
    options.signal?.removeEventListener('abort', onAbort);

    return {
      exitCode: waitResult.StatusCode,
      stdout: stdout.getText(),
      stderr: stderr.getText(),
      truncated: stdout.isTruncated() || stderr.isTruncated(),
      timedOut,
      cancelled,
      containerId: container.id,
    };
  } catch (err) {
    settled = true;
    clearTimeout(timeoutHandle);
    options.signal?.removeEventListener('abort', onAbort);

    if (timedOut || cancelled) {
      return {
        exitCode: null,
        stdout: stdout.getText(),
        stderr: stderr.getText(),
        truncated: stdout.isTruncated() || stderr.isTruncated(),
        timedOut,
        cancelled,
        containerId: container.id,
      };
    }

    logger.error('sandbox.executor.failed', {
      sandboxId: options.sandboxId,
      error: err instanceof Error ? err.message : err,
    });
    throw err;
  } finally {
    await forceRemove(container);
  }
}
