import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../../services/workspace/preview.service', () => ({
  previewOperations: vi.fn().mockResolvedValue({ valid: true, errors: [], conflicts: [] }),
}));

vi.mock('../../services/workspace/virtual-file-system.service', () => ({
  readFile: vi.fn(),
}));

vi.mock('../../services/workspace/batch.service', () => ({ applyBatch: vi.fn() }));
vi.mock('../../services/workspace/lock.service', () => ({ acquireLock: vi.fn(), releaseLock: vi.fn() }));
vi.mock('../../services/workspace/snapshot.service', () => ({ createSnapshot: vi.fn(), restoreSnapshot: vi.fn() }));

import * as previewService from '../../services/workspace/preview.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import { previewBackendOperations } from './backend.operations';

describe('previewBackendOperations', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(previewService.previewOperations).mockResolvedValue({ valid: true, errors: [], conflicts: [] } as never);
  });

  it("repairs an 'update' on a path that doesn't exist into a 'create'", async () => {
    vi.mocked(vfs.readFile).mockRejectedValue(new Error('not found'));

    const { operationsWithDiff } = await previewBackendOperations(owner, 'p1', [
      { type: 'update', path: 'server/app.js', content: "const app = require('express')();", reason: 'wire it up' },
    ]);

    expect(operationsWithDiff[0].type).toBe('create');
    expect(operationsWithDiff[0].content).toBe("const app = require('express')();");

    const batchOps = vi.mocked(previewService.previewOperations).mock.calls[0][2] as unknown as Array<{ type: string }>;
    expect(batchOps[0].type).toBe('create');
  });

  it("leaves an 'update' on a path that does exist unchanged", async () => {
    vi.mocked(vfs.readFile).mockResolvedValue({ content: 'old content' } as never);

    const { operationsWithDiff } = await previewBackendOperations(owner, 'p1', [
      { type: 'update', path: 'server/app.js', content: 'new content', reason: 'edit it' },
    ]);

    expect(operationsWithDiff[0].type).toBe('update');
    expect(operationsWithDiff[0].originalContent).toBe('old content');
  });

  it('leaves a create operation on a path that truly does not exist unchanged', async () => {
    vi.mocked(vfs.readFile).mockRejectedValue(new Error('not found'));

    const { operationsWithDiff } = await previewBackendOperations(owner, 'p1', [
      { type: 'create', path: 'server/routes/todo.routes.js', content: 'x', reason: 'new file' },
    ]);

    expect(operationsWithDiff[0].type).toBe('create');
  });

  it("repairs a 'create' on a path that already exists into an 'update'", async () => {
    vi.mocked(vfs.readFile).mockResolvedValue({ content: 'old content' } as never);

    const { operationsWithDiff } = await previewBackendOperations(owner, 'p1', [
      { type: 'create', path: 'server/routes/todo.routes.js', content: 'new content', reason: 'todo routes' },
    ]);

    expect(operationsWithDiff[0].type).toBe('update');
    expect(operationsWithDiff[0].originalContent).toBe('old content');

    const batchOps = vi.mocked(previewService.previewOperations).mock.calls[0][2] as unknown as Array<{ type: string }>;
    expect(batchOps[0].type).toBe('update');
  });
});
