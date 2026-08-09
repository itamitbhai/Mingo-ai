import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType } from 'shared';

vi.mock('../../models', () => ({
  ProjectFileModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    exists: vi.fn(),
    bulkWrite: vi.fn(),
  },
}));

vi.mock('../project.service', () => ({
  getProjectById: vi.fn(),
}));

import { ProjectFileModel } from '../../models';
import * as projectService from '../project.service';
import { moveEntry, moveOrRenameEntry } from './move.service';

describe('move.service', () => {
  const owner = new Types.ObjectId();
  const project = new Types.ObjectId();
  const projectDoc = { _id: project };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(projectDoc as never);
  });

  describe('moveOrRenameEntry', () => {
    it('throws a 404 when the entry does not exist', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(null);

      await expect(moveOrRenameEntry(owner, project, 'old.txt', 'new.txt')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('is a no-op when the destination equals the source', async () => {
      const entry = { path: 'a.txt', type: FileEntryType.FILE, save: vi.fn() };
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(entry as never);

      const result = await moveOrRenameEntry(owner, project, 'a.txt', 'a.txt');

      expect(result.descendantsUpdated).toBe(0);
      expect(entry.save).not.toHaveBeenCalled();
    });

    it('throws a conflict when the destination path is already taken', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue({
        path: 'old.txt',
        type: FileEntryType.FILE,
        save: vi.fn(),
      } as never);
      vi.mocked(ProjectFileModel.exists).mockResolvedValue({ _id: new Types.ObjectId() } as never);

      await expect(moveOrRenameEntry(owner, project, 'old.txt', 'new.txt')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('rejects moving a folder into one of its own descendants', async () => {
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue({
        path: 'src',
        type: FileEntryType.FOLDER,
        save: vi.fn(),
      } as never);

      await expect(moveOrRenameEntry(owner, project, 'src', 'src/nested')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(ProjectFileModel.exists).not.toHaveBeenCalled();
    });

    it('moves a folder to an unrelated destination and cascades descendant paths', async () => {
      const folder = { path: 'src/components', type: FileEntryType.FOLDER, save: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(ProjectFileModel.findOne).mockResolvedValue(folder as never);
      vi.mocked(ProjectFileModel.exists).mockResolvedValue(null);

      const child = { _id: new Types.ObjectId(), path: 'src/components/Button.tsx', parentPath: 'src/components' };
      vi.mocked(ProjectFileModel.find).mockResolvedValue([child] as never);

      const { entry, descendantsUpdated } = await moveOrRenameEntry(
        owner,
        project,
        'src/components',
        'src/ui/components'
      );

      expect(descendantsUpdated).toBe(1);
      expect(ProjectFileModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: child._id },
            update: { path: 'src/ui/components/Button.tsx', parentPath: 'src/ui/components' },
          },
        },
      ]);
      expect(entry.path).toBe('src/ui/components');
      expect((entry as unknown as { parentPath: string }).parentPath).toBe('src/ui');
    });
  });

  describe('moveEntry', () => {
    it('throws a 400 when the destination folder does not exist', async () => {
      vi.mocked(ProjectFileModel.exists).mockResolvedValue(null);

      await expect(moveEntry(owner, 'p1', 'a.txt', 'missing/a.txt')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(ProjectFileModel.findOne).not.toHaveBeenCalled();
    });

    it('rejects a path-traversal attempt before touching the database', async () => {
      await expect(moveEntry(owner, 'p1', '../../etc/passwd', 'a.txt')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(ProjectFileModel.findOne).not.toHaveBeenCalled();
    });

    it('never touches ProjectFileModel when the caller does not own the project', async () => {
      vi.mocked(projectService.getProjectById).mockRejectedValue(
        Object.assign(new Error('Project not found'), { statusCode: 404 })
      );

      await expect(moveEntry(owner, 'p1', 'a.txt', 'b.txt')).rejects.toMatchObject({ statusCode: 404 });
      expect(ProjectFileModel.findOne).not.toHaveBeenCalled();
    });
  });
});
