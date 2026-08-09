import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType } from 'shared';

vi.mock('../../models', () => ({
  ProjectFileModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    deleteMany: vi.fn(),
  },
  ProjectFileVersionModel: {
    findOne: vi.fn(),
  },
  WorkspaceSnapshotModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../project.service', () => ({
  getProjectById: vi.fn(),
}));

vi.mock('./workspace.service', () => ({
  ensureWorkspace: vi.fn(),
  touchWorkspace: vi.fn(),
}));

vi.mock('./workspace-activity.service', () => ({
  logActivity: vi.fn(),
}));

vi.mock('./version.service', () => ({
  recordVersion: vi.fn(),
}));

vi.mock('./cache.service', () => ({
  workspaceCache: { invalidate: vi.fn() },
}));

// Unit tests run against mocked models with no real MongoDB connection, so `mongoose.startSession()`
// (real transactions) isn't available here — bypass it the same way the service does when the
// server doesn't support transactions (spec §9/§35).
vi.mock('../../utils/withTransaction', () => ({
  withTransaction: (fn: (session: undefined) => Promise<unknown>) => fn(undefined),
}));

import {
  ProjectFileModel,
  ProjectFileVersionModel,
  WorkspaceSnapshotModel,
} from '../../models';
import * as projectService from '../project.service';
import { recordVersion } from './version.service';
import { ensureWorkspace } from './workspace.service';
import { createSnapshot, listSnapshots, restoreSnapshot } from './snapshot.service';

/** Mimics a Mongoose Query: awaitable directly AND chainable via `.session()`/`.select()`. */
function chainable<T>(resolved: T) {
  const obj: Record<string, unknown> = {
    then: (onFulfilled: (value: T) => unknown, onRejected?: (err: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
    session: vi.fn().mockResolvedValue(resolved),
    select: vi.fn(),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
  };
  obj.select = vi.fn().mockReturnValue(obj);
  obj.sort = vi.fn().mockReturnValue(obj);
  obj.skip = vi.fn().mockReturnValue(obj);
  obj.limit = vi.fn().mockResolvedValue(resolved);
  return obj;
}

describe('snapshot.service', () => {
  const owner = new Types.ObjectId();
  const project = new Types.ObjectId();
  const projectDoc = { _id: project, frontend: 'React' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(projectDoc as never);
    vi.mocked(ensureWorkspace).mockResolvedValue({ activeVersion: 2 } as never);
  });

  describe('createSnapshot', () => {
    it('builds one entry per file/folder and counts only files toward fileCount', async () => {
      const files = [
        { _id: new Types.ObjectId(), path: 'a.txt', type: FileEntryType.FILE, version: 1, checksum: 'x', content: 'x' },
        { _id: new Types.ObjectId(), path: 'src', type: FileEntryType.FOLDER, version: 1, checksum: undefined, content: undefined },
      ];
      vi.mocked(ProjectFileModel.find).mockResolvedValue(files as never);
      vi.mocked(WorkspaceSnapshotModel.create).mockResolvedValue({ name: 'v1' } as never);

      await createSnapshot(owner, 'p1', 'v1', undefined, owner);

      expect(WorkspaceSnapshotModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'v1',
          version: 2,
          fileCount: 1,
          entries: expect.arrayContaining([expect.objectContaining({ path: 'a.txt' })]),
        })
      );
    });
  });

  describe('listSnapshots', () => {
    it('returns paginated snapshots without their entries payload', async () => {
      vi.mocked(WorkspaceSnapshotModel.find).mockReturnValue(chainable([{ name: 'v1' }]) as never);
      vi.mocked(WorkspaceSnapshotModel.countDocuments).mockResolvedValue(1 as never);

      const result = await listSnapshots(owner, 'p1', 1, 20);

      expect(result.items).toEqual([{ name: 'v1' }]);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('restoreSnapshot', () => {
    it('throws a 404 when the snapshot does not exist', async () => {
      vi.mocked(WorkspaceSnapshotModel.findOne).mockResolvedValue(null);

      await expect(restoreSnapshot(owner, 'p1', new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('creates an automatic backup, restores changed files, and logs the restore', async () => {
      const fileId = new Types.ObjectId();
      const target = {
        _id: new Types.ObjectId(),
        name: 'Before refactor',
        entries: [
          { file: fileId, path: 'a.txt', type: FileEntryType.FILE, version: 2, checksum: 'old-checksum' },
        ],
      };
      vi.mocked(WorkspaceSnapshotModel.findOne).mockResolvedValue(target as never);

      // Backup snapshot creation (createSnapshot runs for real, only its model calls are mocked).
      vi.mocked(ProjectFileModel.find)
        .mockResolvedValueOnce([
          { _id: fileId, path: 'a.txt', type: FileEntryType.FILE, version: 3, checksum: 'new-checksum', content: 'new' },
        ] as never) // buildSnapshotEntries (backup)
        .mockReturnValueOnce(chainable([{ _id: fileId, path: 'a.txt' }]) as never); // post-restore reconciliation pass
      vi.mocked(WorkspaceSnapshotModel.create).mockResolvedValue({ name: 'Automatic backup before restoring "Before refactor"' } as never);

      const currentFile = { _id: fileId, checksum: 'new-checksum', content: 'new', version: 3, save: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(ProjectFileModel.findOne).mockReturnValue(chainable(currentFile) as never);
      vi.mocked(ProjectFileVersionModel.findOne).mockReturnValue(
        chainable({ content: 'old', checksum: 'old-checksum' }) as never
      );

      const result = await restoreSnapshot(owner, 'p1', target._id.toString());

      expect(currentFile.save).toHaveBeenCalled();
      expect(currentFile.content).toBe('old');
      expect(recordVersion).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: 'restore' })
      );
      expect(ProjectFileModel.deleteMany).not.toHaveBeenCalled();
      expect(result.snapshot).toBe(target);
      expect(result.backup).toMatchObject({
        name: 'Automatic backup before restoring "Before refactor"',
      });
    });
  });
});
