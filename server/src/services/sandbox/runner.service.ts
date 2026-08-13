import { ChildProcess, spawn } from 'node:child_process';
import { logger } from '../../utils/logger';
import { assertSafeEnv, buildSandboxEnv } from './sandbox.security';
import { RunProcessOptions, RunProcessResult } from './sandbox.types';

/** Windows can't directly execute `.cmd` shims (`npm`) without a shell, and killing just the spawned
 *  `cmd.exe` leaves the real `node.exe` child running — `taskkill /T` kills the whole tree. On POSIX,
 *  `detached: true` + a negative pid signals the whole process group instead. */
function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Process already exited.
    }
  }
}

/**
 * Spawns exactly one process inside the sandbox (`npm install`/`npm ci`, or a detected test command)
 * with a hard wall-clock timeout, a caller-provided `AbortSignal` for cancellation, an allowlisted env
 * (never the Mingo server's own `process.env` — see `sandbox.security.ts`), and capped/truncated
 * output capture. Every field the AI-generation and dashboard layers ever see traces back to this
 * function's real `exitCode`/`stdout`/`stderr` — nothing here is simulated.
 */
export async function runProcess(options: RunProcessOptions): Promise<RunProcessResult> {
  const env = buildSandboxEnv();
  assertSafeEnv(env);

  return new Promise<RunProcessResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let cancelled = false;
    let settled = false;

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env,
      shell: process.platform === 'win32',
      windowsHide: true,
      detached: process.platform !== 'win32',
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, options.timeoutMs);

    const onAbort = () => {
      cancelled = true;
      killProcessTree(child);
    };
    options.signal?.addEventListener('abort', onAbort);

    const append = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
      const text = chunk.toString('utf8');
      options.onOutput?.(text, stream);

      if (stream === 'stdout') {
        if (stdout.length >= options.maxOutputChars) {
          truncated = true;
          return;
        }
        stdout = (stdout + text).slice(0, options.maxOutputChars);
      } else {
        if (stderr.length >= options.maxOutputChars) {
          truncated = true;
          return;
        }
        stderr = (stderr + text).slice(0, options.maxOutputChars);
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => append(chunk, 'stdout'));
    child.stderr?.on('data', (chunk: Buffer) => append(chunk, 'stderr'));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      logger.error('sandbox.runner.spawn_failed', {
        command: options.command,
        cwd: options.cwd,
        error: err.message,
      });
      reject(err);
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({ exitCode: code, signal, stdout, stderr, truncated, timedOut, cancelled });
    });
  });
}
