import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileChangeType } from 'shared';

vi.mock('../../models', () => ({
  ProjectFileVersionModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

import { ProjectFileVersionModel } from '../../models';
import { getVersion, listVersions, recordVersion } from './version.service';

function mockQuery(resolved: unknown) {
  const query = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolved),
  };
  return query;
}

describe('version.service', () => {
  const owner = new Types.ObjectId();
  const project = new Types.ObjectId();
  const fileId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordVersion', () => {
    it('creates an immutable version document', async () => {
      vi.mocked(ProjectFileVersionModel.create).mockResolvedValue({} as never);

      await recordVersion({
        file: fileId,
        project,
        owner,
        version: 1,
        content: 'hello',
        checksum: 'abc',
        changedBy: owner,
        changeType: FileChangeType.CREATE,
      });

      expect(ProjectFileVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1, changeType: FileChangeType.CREATE })
      );
    });
  });

  describe('listVersions', () => {
    it('reports hasMore and a nextCursor when there are more results than the page size', async () => {
      const docs = Array.from({ length: 3 }, (_, i) => ({ _id: new Types.ObjectId(), version: 3 - i }));
      vi.mocked(ProjectFileVersionModel.find).mockReturnValue(mockQuery(docs) as never);

      const result = await listVersions(owner, project, fileId, undefined, 2);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe(docs[1]._id.toString());
    });

    it('reports hasMore as false when everything fits on one page', async () => {
      const docs = [{ _id: new Types.ObjectId(), version: 1 }];
      vi.mocked(ProjectFileVersionModel.find).mockReturnValue(mockQuery(docs) as never);

      const result = await listVersions(owner, project, fileId, undefined, 10);

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('getVersion', () => {
    it('throws a 400 for a malformed id', async () => {
      await expect(getVersion(owner, project, 'not-an-id')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws a 404 when the version does not belong to this owner/project', async () => {
      vi.mocked(ProjectFileVersionModel.findOne).mockResolvedValue(null);

      await expect(getVersion(owner, project, new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
