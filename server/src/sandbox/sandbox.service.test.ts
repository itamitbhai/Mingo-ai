import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { SandboxStatus } from 'shared';

vi.mock('./sandbox.config', () => ({
  sandboxConfig: {
    IMAGE_TAG: 'mingo-sandbox:node22-v1',
    MEMORY_MB: 1024,
    CPU_CORES: 1.5,
    PIDS_LIMIT: 256,
    TIMEOUT_MS: 300000,
    INSTALL_TIMEOUT_MS: 180000,
    MAX_LOG_CHARS: 200000,
  },
}));

vi.mock('../models', () => ({
  SandboxSessionModel: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../services/project.service', () => ({
  getProjectById: vi.fn(),
}));

// `executeSandbox` (which talks to Docker) is mocked so this test never touches the real sandbox
// engine — mirrors how `orchestrator.service.test.ts` mocks `./orchestrator`'s `runWorkflow`.
vi.mock('./sandbox.manager', () => ({
  executeSandbox: vi.fn().mockResolvedValue(undefined),
}));

import { SandboxSessionModel } from '../models';
import * as projectService from '../services/project.service';
import { executeSandbox } from './sandbox.manager';
import { createSandboxRun, getSandboxRun, listSandboxRuns, requestStop, stopSandboxRun } from './sandbox.service';

function findChainable<T>(resolved: T) {
  return { sort: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(resolved) };
}

describe('sandbox.service', () => {
  const owner = new Types.ObjectId();
  const project = { _id: new Types.ObjectId(), id: 'p1' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(project as never);
  });

  describe('createSandboxRun', () => {
    it('rejects a commandLine containing shell chaining before ever creating a session', async () => {
      await expect(
        createSandboxRun(owner, 'p1', { commandLine: 'npm run build && rm -rf /' })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(SandboxSessionModel.create).not.toHaveBeenCalled();
      expect(executeSandbox).not.toHaveBeenCalled();
    });

    it('rejects a structured command naming a denylisted binary', async () => {
      await expect(createSandboxRun(owner, 'p1', { command: 'docker' as never, args: ['ps'] })).rejects.toMatchObject(
        { statusCode: 400 }
      );
      expect(SandboxSessionModel.create).not.toHaveBeenCalled();
    });

    it('creates a queued session and starts execution in the background for a valid commandLine', async () => {
      vi.mocked(SandboxSessionModel.create).mockResolvedValue({ id: 'sb1' } as never);

      const session = await createSandboxRun(owner, 'p1', { commandLine: 'npm run build' });

      expect(SandboxSessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project: project._id,
          owner,
          status: SandboxStatus.CREATING,
          command: 'npm',
          args: ['run', 'build'],
        })
      );
      expect((session as unknown as { id: string }).id).toBe('sb1');

      // executeSandbox is called fire-and-forget — flush microtasks so the call is observable.
      await Promise.resolve();
      expect(executeSandbox).toHaveBeenCalledWith(
        expect.objectContaining({ networkMode: 'none' })
      );
    });

    it('runs npm install/ci with network access, everything else with none (spec §26/§27)', async () => {
      vi.mocked(SandboxSessionModel.create).mockResolvedValue({ id: 'sb1' } as never);

      await createSandboxRun(owner, 'p1', { commandLine: 'npm install' });
      await Promise.resolve();
      expect(executeSandbox).toHaveBeenLastCalledWith(expect.objectContaining({ networkMode: 'install' }));

      await createSandboxRun(owner, 'p1', { commandLine: 'npm ci' });
      await Promise.resolve();
      expect(executeSandbox).toHaveBeenLastCalledWith(expect.objectContaining({ networkMode: 'install' }));

      await createSandboxRun(owner, 'p1', { commandLine: 'npm test' });
      await Promise.resolve();
      expect(executeSandbox).toHaveBeenLastCalledWith(expect.objectContaining({ networkMode: 'none' }));
    });
  });

  describe('getSandboxRun / listSandboxRuns', () => {
    it('rejects an invalid sandbox id', async () => {
      await expect(getSandboxRun(owner, 'p1', 'not-an-id')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('404s when no session matches this owner/project', async () => {
      vi.mocked(SandboxSessionModel.findOne).mockResolvedValue(null as never);
      await expect(getSandboxRun(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('lists sessions scoped to the project, newest first', async () => {
      vi.mocked(SandboxSessionModel.find).mockReturnValue(findChainable([{ id: 's1' }]) as never);
      const sessions = await listSandboxRuns(owner, 'p1');
      expect(SandboxSessionModel.find).toHaveBeenCalledWith({ project: project._id });
      expect(sessions).toEqual([{ id: 's1' }]);
    });
  });

  describe('stopSandboxRun / requestStop', () => {
    it('returns false from requestStop when nothing is registered for that id', () => {
      expect(requestStop('unregistered-id')).toBe(false);
    });

    it('rejects stopping a sandbox that is not currently running', async () => {
      const sandboxId = new Types.ObjectId().toString();
      vi.mocked(SandboxSessionModel.findOne).mockResolvedValue({ id: sandboxId } as never);

      await expect(stopSandboxRun(owner, 'p1', sandboxId)).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
