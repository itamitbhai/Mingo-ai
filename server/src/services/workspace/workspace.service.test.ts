import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FrontendStack, WorkspaceStatus } from 'shared';

vi.mock('../../models', () => ({
  ProjectFileModel: {
    countDocuments: vi.fn(),
    exists: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
  ProjectWorkspaceModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../project.service', () => ({
  getProjectById: vi.fn(),
}));

import { ProjectFileModel, ProjectWorkspaceModel } from '../../models';
import * as projectService from '../project.service';
import { ensureWorkspace, getManifest, touchWorkspace } from './workspace.service';

describe('workspace.service', () => {
  const owner = new Types.ObjectId();
  const project = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureWorkspace', () => {
    it('returns the existing workspace instead of creating a duplicate', async () => {
      const existing = { project, owner };
      vi.mocked(ProjectWorkspaceModel.findOne).mockResolvedValue(existing as never);

      const result = await ensureWorkspace(owner, project);

      expect(result).toBe(existing);
      expect(ProjectWorkspaceModel.create).not.toHaveBeenCalled();
    });

    it('creates a new workspace when none exists', async () => {
      vi.mocked(ProjectWorkspaceModel.findOne).mockResolvedValue(null);
      vi.mocked(ProjectWorkspaceModel.create).mockResolvedValue({ status: WorkspaceStatus.READY } as never);

      const result = await ensureWorkspace(owner, project, 'React');

      expect(ProjectWorkspaceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ project, owner, status: WorkspaceStatus.READY })
      );
      expect(result).toMatchObject({ status: WorkspaceStatus.READY });
    });

    it('re-reads the workspace on a duplicate-key race instead of failing', async () => {
      vi.mocked(ProjectWorkspaceModel.findOne)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ project, owner } as never);
      vi.mocked(ProjectWorkspaceModel.create).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

      const result = await ensureWorkspace(owner, project);

      expect(result).toMatchObject({ project, owner });
    });
  });

  describe('touchWorkspace', () => {
    it('never throws even if the update fails', async () => {
      vi.mocked(ProjectWorkspaceModel.updateOne).mockReturnValue(
        Promise.reject(new Error('workspace update down')) as never
      );

      await expect(touchWorkspace(owner, project)).resolves.toBeUndefined();
    });
  });

  describe('getManifest', () => {
    it('computes counts and entry points from real ProjectFile documents', async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        _id: project,
        frontend: FrontendStack.REACT,
      } as never);
      vi.mocked(ProjectFileModel.countDocuments)
        .mockResolvedValueOnce(5 as never) // files
        .mockResolvedValueOnce(2 as never); // folders
      vi.mocked(ProjectFileModel.exists).mockResolvedValue(null); // no TypeScript files
      vi.mocked(ProjectFileModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([{ path: 'src/main.jsx' }]),
      } as never);
      vi.mocked(ProjectFileModel.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      const manifest = await getManifest(owner, 'p1');

      expect(manifest).toMatchObject({
        framework: FrontendStack.REACT,
        language: 'JavaScript',
        files: 5,
        folders: 2,
        entryPoints: ['src/main.jsx'],
        packageManager: 'npm',
      });
    });

    it('never fabricates entry points that do not exist as real files', async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        _id: project,
        frontend: FrontendStack.REACT,
      } as never);
      vi.mocked(ProjectFileModel.countDocuments).mockResolvedValue(0 as never);
      vi.mocked(ProjectFileModel.exists).mockResolvedValue(null);
      vi.mocked(ProjectFileModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as never);
      vi.mocked(ProjectFileModel.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      const manifest = await getManifest(owner, 'p1');

      expect(manifest.entryPoints).toEqual([]);
    });
  });
});
