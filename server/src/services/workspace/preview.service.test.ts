import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { BatchOperationInput, BatchOperationType, FileEntryType } from 'shared';

vi.mock('../../config/workspace.config', () => ({
  workspaceConfig: {
    MAX_FILE_SIZE_BYTES: 1_000,
    MAX_BATCH_OPERATIONS: 3,
    MAX_PROJECT_FILES: 100,
    MAX_PATH_LENGTH: 500,
    LOCK_TTL_MS: 1_000,
    CACHE_TTL_MS: 1_000,
  },
}));

vi.mock('../../models', () => ({
  ProjectFileModel: {
    find: vi.fn(),
  },
}));

vi.mock('../project.service', () => ({
  getProjectById: vi.fn(),
}));

import { ProjectFileModel } from '../../models';
import * as projectService from '../project.service';
import { planOperations, previewOperations } from './preview.service';

function op(input: BatchOperationInput): BatchOperationInput {
  return input;
}

describe('preview.service', () => {
  const owner = new Types.ObjectId();
  const project = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue({ _id: project } as never);
  });

  function withExistingFiles(paths: Array<{ path: string; type?: FileEntryType }>) {
    vi.mocked(ProjectFileModel.find).mockReturnValue({
      select: vi.fn().mockResolvedValue(paths.map((p) => ({ path: p.path, type: p.type ?? FileEntryType.FILE }))),
    } as never);
  }

  it('auto-creates missing ancestor folders for a nested create', async () => {
    withExistingFiles([]);

    const { plan, errors, conflicts } = await planOperations(owner, 'p1', [
      op({ type: BatchOperationType.CREATE, path: 'src/auth/auth.service.ts', content: 'x' }),
    ]);

    expect(errors).toHaveLength(0);
    expect(conflicts).toHaveLength(0);
    const paths = plan.map((entry) => entry.targetPath);
    expect(paths).toEqual(['src', 'src/auth', 'src/auth/auth.service.ts']);
    expect(plan[0].isFolder).toBe(true);
    expect(plan[1].isFolder).toBe(true);
  });

  it('reports a conflict when creating a path that already exists', async () => {
    withExistingFiles([{ path: 'README.md' }]);

    const { conflicts } = await planOperations(owner, 'p1', [
      op({ type: BatchOperationType.CREATE, path: 'README.md', content: 'x' }),
    ]);

    expect(conflicts).toEqual(['"README.md" already exists']);
  });

  it('reports an error when updating a path that does not exist', async () => {
    withExistingFiles([]);

    const { errors } = await planOperations(owner, 'p1', [
      op({ type: BatchOperationType.UPDATE, path: 'missing.ts', content: 'x' }),
    ]);

    expect(errors).toEqual(['"missing.ts" does not exist']);
  });

  it('reports an error when moving a folder into its own descendant', async () => {
    withExistingFiles([{ path: 'src', type: FileEntryType.FOLDER }]);

    const { errors } = await planOperations(owner, 'p1', [
      op({ type: BatchOperationType.MOVE, path: 'src', destinationPath: 'src/nested' }),
    ]);

    expect(errors).toEqual(['Cannot move "src" into its own descendant']);
  });

  it('reports a conflict when two operations target the same path', async () => {
    withExistingFiles([]);

    const { conflicts } = await planOperations(owner, 'p1', [
      op({ type: BatchOperationType.CREATE, path: 'a.ts', content: '1' }),
      op({ type: BatchOperationType.CREATE, path: 'a.ts', content: '2' }),
    ]);

    expect(conflicts.some((c) => c.includes('a.ts'))).toBe(true);
  });

  it('rejects a batch larger than the configured limit', async () => {
    withExistingFiles([]);

    const { errors } = await planOperations(
      owner,
      'p1',
      Array.from({ length: 4 }, (_, i) => op({ type: BatchOperationType.CREATE, path: `f${i}.ts`, content: 'x' }))
    );

    expect(errors.some((e) => e.includes('at most 3'))).toBe(true);
  });

  it('previewOperations marks the result invalid when there are errors or conflicts', async () => {
    withExistingFiles([{ path: 'README.md' }]);

    const result = await previewOperations(owner, 'p1', [
      op({ type: BatchOperationType.CREATE, path: 'README.md', content: 'x' }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(1);
  });
});
