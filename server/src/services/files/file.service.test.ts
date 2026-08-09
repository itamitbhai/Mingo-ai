import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType } from 'shared';

vi.mock('../../models', () => ({
  ProjectFileModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
    bulkWrite: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../project.service', () => ({
  getProjectById: vi.fn(),
}));

// The version/activity/cache/workspace side effects each mutation triggers (spec §6/§21/§36) are
// exercised by their own unit tests — here they're stubbed out so file.service's tests stay
// focused on file.service's own behavior.
vi.mock('../workspace/version.service', () => ({
  recordVersion: vi.fn(),
}));

vi.mock('../workspace/workspace-activity.service', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../workspace/workspace.service', () => ({
  touchWorkspace: vi.fn(),
}));

vi.mock('../workspace/cache.service', () => ({
  workspaceCache: { invalidate: vi.fn(), get: vi.fn(), set: vi.fn(), clear: vi.fn() },
}));

import { ProjectFileModel } from '../../models';
import * as projectService from '../project.service';
import * as fileService from './file.service';

describe('file.service', () => {
  const owner = new Types.ObjectId();
  const projectDoc = { _id: new Types.ObjectId() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(projectDoc as never);
  });

  describe('createFile', () => {
    it('creates a root-level file without checking for a parent folder', async () => {
      vi.mocked(ProjectFileModel.create).mockResolvedValue({ path: 'README.md' } as never);

      await fileService.createFile(owner, 'p1', 'README.md', '# Hi');

      expect(ProjectFileModel.findOne).not.toHaveBeenCalled();
      expect(ProjectFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'README.md', type: FileEntryType.FILE, parentPath: null })
      );
    });

    it('throws when the parent folder does not exist', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(null);

      await expect(fileService.createFile(owner, 'p1', 'src/App.tsx')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(ProjectFileModel.create).not.toHaveBeenCalled();
    });

    it('creates a nested file once its parent folder is confirmed', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue({
        path: 'src',
        type: FileEntryType.FOLDER,
      } as never);
      vi.mocked(ProjectFileModel.create).mockResolvedValue({ path: 'src/App.tsx' } as never);

      await fileService.createFile(owner, 'p1', 'src/App.tsx');

      expect(ProjectFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'src/App.tsx', parentPath: 'src', language: 'typescript' })
      );
    });

    it('rejects a path-traversal attempt before touching the database', async () => {
      await expect(fileService.createFile(owner, 'p1', '../../etc/passwd')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(ProjectFileModel.create).not.toHaveBeenCalled();
    });

    it('translates a duplicate-key error into a 409 conflict', async () => {
      vi.mocked(ProjectFileModel.create).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

      await expect(fileService.createFile(owner, 'p1', 'README.md')).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('updateFileContent', () => {
    it('throws a 409 when expectedVersion does not match', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue({ version: 3, save: vi.fn() } as never);

      await expect(
        fileService.updateFileContent(owner, 'p1', 'README.md', 'new content', 2)
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('saves and increments the version when expectedVersion matches', async () => {
      const doc = { version: 3, content: '', size: 0, save: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(doc as never);

      const result = await fileService.updateFileContent(owner, 'p1', 'README.md', 'new content', 3);

      expect(doc.save).toHaveBeenCalled();
      expect(result.version).toBe(4);
      expect(result.content).toBe('new content');
    });

    it('throws a 404 when the file does not exist', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(null);

      await expect(
        fileService.updateFileContent(owner, 'p1', 'missing.txt', 'x')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('renameEntry', () => {
    it('throws a 404 when the entry does not exist', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(null);

      await expect(fileService.renameEntry(owner, 'p1', 'old.txt', 'new.txt')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('throws a conflict when the destination path is already taken', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue({
        type: FileEntryType.FILE,
        path: 'old.txt',
        save: vi.fn(),
      } as never);
      vi.mocked(ProjectFileModel.exists).mockResolvedValue({ _id: new Types.ObjectId() } as never);

      await expect(fileService.renameEntry(owner, 'p1', 'old.txt', 'new.txt')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('cascades path updates to every descendant when renaming a folder', async () => {
      const folder = {
        type: FileEntryType.FOLDER,
        path: 'components',
        name: 'components',
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(folder as never);
      vi.mocked(ProjectFileModel.exists).mockResolvedValue(null);

      const child = {
        _id: new Types.ObjectId(),
        path: 'components/Button.tsx',
        parentPath: 'components',
      };
      const grandchild = {
        _id: new Types.ObjectId(),
        path: 'components/ui/Icon.tsx',
        parentPath: 'components/ui',
      };
      vi.mocked(ProjectFileModel.find).mockResolvedValue([child, grandchild] as never);

      await fileService.renameEntry(owner, 'p1', 'components', 'widgets');

      expect(ProjectFileModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: child._id },
            update: { path: 'widgets/Button.tsx', parentPath: 'widgets' },
          },
        },
        {
          updateOne: {
            filter: { _id: grandchild._id },
            update: { path: 'widgets/ui/Icon.tsx', parentPath: 'widgets/ui' },
          },
        },
      ]);
      expect(folder.path).toBe('widgets');
      expect(folder.name).toBe('widgets');
    });
  });

  describe('deleteEntry', () => {
    it('throws a 404 when the entry does not exist', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(null);

      await expect(fileService.deleteEntry(owner, 'p1', 'missing.txt')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('deletes a file directly', async () => {
      const doc = { type: FileEntryType.FILE, deleteOne: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(doc as never);

      await fileService.deleteEntry(owner, 'p1', 'README.md');

      expect(doc.deleteOne).toHaveBeenCalled();
      expect(ProjectFileModel.deleteMany).not.toHaveBeenCalled();
    });

    it('cascades deletion to every descendant when deleting a folder', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue({
        type: FileEntryType.FOLDER,
        path: 'components',
      } as never);
      vi.mocked(ProjectFileModel.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);

      await fileService.deleteEntry(owner, 'p1', 'components');

      expect(ProjectFileModel.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ project: projectDoc._id, owner })
      );
    });
  });

  describe('ownership', () => {
    it('never touches ProjectFileModel when the caller does not own the project', async () => {
      vi.mocked(projectService.getProjectById).mockRejectedValue(
        Object.assign(new Error('Project not found'), { statusCode: 404 })
      );

      await expect(fileService.getFileContent(owner, 'p1', 'README.md')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(ProjectFileModel.findOne).not.toHaveBeenCalled();
    });
  });
});
