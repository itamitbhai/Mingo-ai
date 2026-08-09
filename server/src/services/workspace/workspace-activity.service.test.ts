import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { WorkspaceActivityAction } from 'shared';

vi.mock('../../models', () => ({
  WorkspaceActivityModel: {
    create: vi.fn(),
    find: vi.fn(),
  },
}));

import { WorkspaceActivityModel } from '../../models';
import { listActivity, logActivity } from './workspace-activity.service';

function mockQuery(resolved: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolved),
  };
}

describe('workspace-activity.service', () => {
  const owner = new Types.ObjectId();
  const project = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs an activity entry', async () => {
    vi.mocked(WorkspaceActivityModel.create).mockResolvedValue({} as never);

    await logActivity({
      project,
      user: owner,
      action: WorkspaceActivityAction.CREATE,
      description: 'Created "README.md"',
    });

    expect(WorkspaceActivityModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: WorkspaceActivityAction.CREATE })
    );
  });

  it('paginates activity with a cursor', async () => {
    const docs = Array.from({ length: 3 }, (_, i) => ({ _id: new Types.ObjectId(), description: `#${i}` }));
    vi.mocked(WorkspaceActivityModel.find).mockReturnValue(mockQuery(docs) as never);

    const result = await listActivity(project, owner, undefined, 2);

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(WorkspaceActivityModel.find).toHaveBeenCalledWith({ project, user: owner });
  });
});
