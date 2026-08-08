import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType } from 'shared';

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
import { getFileTree } from './file-tree.service';

function makeDoc(path: string, type: FileEntryType, parentPath: string | null) {
  const name = path.split('/').pop() as string;
  return {
    path,
    name,
    type,
    parentPath,
    toJSON: () => ({ path, name, type, parentPath }),
  };
}

describe('file-tree.service', () => {
  const owner = new Types.ObjectId();
  const projectDoc = { _id: new Types.ObjectId() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(projectDoc as never);
  });

  it('nests children under their parent folder', async () => {
    const docs = [
      makeDoc('src', FileEntryType.FOLDER, null),
      makeDoc('src/App.tsx', FileEntryType.FILE, 'src'),
      makeDoc('README.md', FileEntryType.FILE, null),
    ];
    const selectMock = vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue(docs) });
    vi.mocked(ProjectFileModel.find).mockReturnValue({ select: selectMock } as never);

    const tree = await getFileTree(owner, 'p1');

    expect(tree).toHaveLength(2);
    const srcNode = tree.find((node) => node.path === 'src');
    expect(srcNode?.children).toHaveLength(1);
    expect(srcNode?.children?.[0].path).toBe('src/App.tsx');
  });

  it('sorts folders before files, then alphabetically within each group', async () => {
    const docs = [
      makeDoc('zeta.txt', FileEntryType.FILE, null),
      makeDoc('components', FileEntryType.FOLDER, null),
      makeDoc('alpha.txt', FileEntryType.FILE, null),
      makeDoc('assets', FileEntryType.FOLDER, null),
    ];
    const selectMock = vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue(docs) });
    vi.mocked(ProjectFileModel.find).mockReturnValue({ select: selectMock } as never);

    const tree = await getFileTree(owner, 'p1');

    expect(tree.map((node) => node.path)).toEqual(['assets', 'components', 'alpha.txt', 'zeta.txt']);
  });
});
