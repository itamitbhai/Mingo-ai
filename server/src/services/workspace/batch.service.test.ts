import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { BatchOperationType } from 'shared';

vi.mock('../files/file.service', () => ({
  createFile: vi.fn(),
  createFolder: vi.fn(),
  updateFileContent: vi.fn(),
  renameEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

vi.mock('./move.service', () => ({
  moveEntry: vi.fn(),
}));

vi.mock('./preview.service', () => ({
  planOperations: vi.fn(),
}));

import * as fileService from '../files/file.service';
import { moveEntry } from './move.service';
import { planOperations } from './preview.service';
import { applyBatch } from './batch.service';

function fakeDoc(overrides: Record<string, unknown> = {}) {
  return { toJSON: () => ({ id: 'f1', ...overrides }) };
}

describe('batch.service', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects the entire batch and applies nothing when validation fails', async () => {
    vi.mocked(planOperations).mockResolvedValue({
      project: {} as never,
      plan: [],
      warnings: [],
      errors: ['"missing.ts" does not exist'],
      conflicts: [],
    });

    await expect(
      applyBatch(owner, 'p1', [{ type: BatchOperationType.UPDATE, path: 'missing.ts', content: 'x' }])
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(fileService.createFile).not.toHaveBeenCalled();
    expect(fileService.updateFileContent).not.toHaveBeenCalled();
  });

  it('applies every planned operation through the versioned file.service/move.service calls', async () => {
    const createOp = { type: BatchOperationType.CREATE, path: 'src/auth', content: undefined };
    const fileOp = { type: BatchOperationType.CREATE, path: 'src/auth/auth.service.ts', content: 'export {}' };
    const updateOp = { type: BatchOperationType.UPDATE, path: 'README.md', content: 'hi' };
    const deleteOp = { type: BatchOperationType.DELETE, path: 'old.ts' };
    const renameOp = { type: BatchOperationType.RENAME, path: 'a.ts', newName: 'b.ts' };
    const moveOp = { type: BatchOperationType.MOVE, path: 'c.ts', destinationPath: 'src/c.ts' };

    vi.mocked(planOperations).mockResolvedValue({
      project: {} as never,
      plan: [
        { op: createOp, action: 'CREATE', targetPath: 'src/auth', existing: null, isFolder: true },
        { op: fileOp, action: 'CREATE', targetPath: 'src/auth/auth.service.ts', existing: null },
        { op: updateOp, action: 'MODIFY', targetPath: 'README.md', existing: null },
        { op: deleteOp, action: 'DELETE', targetPath: 'old.ts', existing: null },
        { op: renameOp, action: 'MODIFY', targetPath: 'b.ts', existing: null },
        { op: moveOp, action: 'MODIFY', targetPath: 'src/c.ts', existing: null },
      ] as never,
      warnings: [],
      errors: [],
      conflicts: [],
    });

    vi.mocked(fileService.createFolder).mockResolvedValue(fakeDoc() as never);
    vi.mocked(fileService.createFile).mockResolvedValue(fakeDoc() as never);
    vi.mocked(fileService.updateFileContent).mockResolvedValue(fakeDoc() as never);
    vi.mocked(fileService.deleteEntry).mockResolvedValue(undefined as never);
    vi.mocked(fileService.renameEntry).mockResolvedValue(fakeDoc() as never);
    vi.mocked(moveEntry).mockResolvedValue({ entry: fakeDoc(), descendantsUpdated: 0, project: {} } as never);

    const result = await applyBatch(owner, 'p1', [createOp, fileOp, updateOp, deleteOp, renameOp, moveOp] as never);

    expect(fileService.createFolder).toHaveBeenCalledWith(owner, 'p1', 'src/auth');
    expect(fileService.createFile).toHaveBeenCalledWith(owner, 'p1', 'src/auth/auth.service.ts', 'export {}');
    expect(fileService.updateFileContent).toHaveBeenCalledWith(owner, 'p1', 'README.md', 'hi');
    expect(fileService.deleteEntry).toHaveBeenCalledWith(owner, 'p1', 'old.ts');
    expect(fileService.renameEntry).toHaveBeenCalledWith(owner, 'p1', 'a.ts', 'b.ts');
    expect(moveEntry).toHaveBeenCalledWith(owner, 'p1', 'c.ts', 'src/c.ts');
    expect(result.applied).toBe(6);
    expect(result.operations.map((o) => o.status)).toEqual([
      'created',
      'created',
      'updated',
      'deleted',
      'renamed',
      'moved',
    ]);
  });
});
