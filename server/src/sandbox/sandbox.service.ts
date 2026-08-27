import { Types } from 'mongoose';
import { CreateSandboxRunInput, SandboxStatus } from 'shared';
import { SandboxSessionDocument, SandboxSessionModel } from '../models';
import { getProjectById } from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { sandboxConfig } from './sandbox.config';
import { executeSandbox } from './sandbox.manager';
import { parseCommandLine, validateCommand } from './sandbox.security';
import { toSandboxCommand } from './sandbox.schema';
import { SandboxNetworkMode } from './sandbox.types';

/** Same single-instance, in-memory registry precedent as `orchestrator.ts`/
 *  `services/sandbox/run-registry.ts` — keyed by `SandboxSession` id so `POST .../stop` (a separate
 *  request) can cancel a run already in flight. */
const activeSandboxes = new Map<string, AbortController>();

export function isSandboxActive(sandboxId: string): boolean {
  return activeSandboxes.has(sandboxId);
}

export function requestStop(sandboxId: string): boolean {
  const controller = activeSandboxes.get(sandboxId);
  if (!controller) return false;
  controller.abort();
  return true;
}

function resolveCommand(body: CreateSandboxRunInput): { command: string; args: string[] } {
  const normalized = toSandboxCommand(body);

  const result =
    normalized.commandLine !== undefined
      ? parseCommandLine(normalized.commandLine)
      : validateCommand(normalized.command as string, normalized.args ?? []);

  if (!result.success) {
    throw ApiError.badRequest(result.error);
  }

  return result.data;
}

/** `npm install`/`npm ci` are the only commands that ever get network access (spec §26/§27) — every
 *  other allowlisted command (`npm run <script>`, `node`, `npx`, `git`) runs fully offline. */
function resolveNetworkMode(command: string, args: string[]): SandboxNetworkMode {
  if (command === 'npm' && (args[0] === 'install' || args[0] === 'ci')) {
    return 'install';
  }
  return 'none';
}

/**
 * Creates and starts a sandbox run (spec §64) — ownership-checked, then detached: the container
 * lifecycle continues after this returns, mirroring `orchestrator.service.createWorkflow`'s pattern.
 */
export async function createSandboxRun(
  owner: Types.ObjectId,
  projectId: string,
  body: CreateSandboxRunInput
): Promise<SandboxSessionDocument> {
  const project = await getProjectById(owner, projectId);
  const { command, args } = resolveCommand(body);
  const networkMode = resolveNetworkMode(command, args);
  const timeoutMs = networkMode === 'install' ? sandboxConfig.INSTALL_TIMEOUT_MS : sandboxConfig.TIMEOUT_MS;

  const session = await SandboxSessionModel.create({
    project: project._id,
    owner,
    status: SandboxStatus.CREATING,
    command,
    args,
    image: sandboxConfig.IMAGE_TAG,
    logs: { stdout: '', stderr: '', truncated: false },
    resourceLimits: {
      memoryMb: sandboxConfig.MEMORY_MB,
      cpuCores: sandboxConfig.CPU_CORES,
      pidsLimit: sandboxConfig.PIDS_LIMIT,
    },
  });

  const sandboxId = session.id as string;
  const controller = new AbortController();
  activeSandboxes.set(sandboxId, controller);

  void executeSandbox({
    session,
    owner,
    projectId,
    command: { command, args },
    networkMode,
    timeoutMs,
    signal: controller.signal,
  })
    .catch((err) => {
      logger.error('sandbox.service.run_failed', { sandboxId, error: err instanceof Error ? err.message : err });
    })
    .finally(() => {
      activeSandboxes.delete(sandboxId);
    });

  return session;
}

async function getSandboxOrThrow(
  owner: Types.ObjectId,
  projectId: string,
  sandboxId: string
): Promise<SandboxSessionDocument> {
  if (!Types.ObjectId.isValid(sandboxId)) {
    throw ApiError.badRequest('Invalid sandbox id');
  }

  const project = await getProjectById(owner, projectId);
  const session = await SandboxSessionModel.findOne({ _id: sandboxId, project: project._id });

  if (!session) {
    throw ApiError.notFound('Sandbox session not found');
  }

  return session;
}

export async function getSandboxRun(owner: Types.ObjectId, projectId: string, sandboxId: string) {
  return getSandboxOrThrow(owner, projectId, sandboxId);
}

export async function listSandboxRuns(owner: Types.ObjectId, projectId: string) {
  const project = await getProjectById(owner, projectId);
  return SandboxSessionModel.find({ project: project._id }).sort({ createdAt: -1 }).limit(50);
}

export async function stopSandboxRun(owner: Types.ObjectId, projectId: string, sandboxId: string) {
  const session = await getSandboxOrThrow(owner, projectId, sandboxId);

  if (!requestStop(sandboxId)) {
    throw ApiError.badRequest('This sandbox is not currently running.');
  }

  return session;
}
