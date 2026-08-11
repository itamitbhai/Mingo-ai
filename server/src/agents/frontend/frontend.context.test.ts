import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType, IPlanTask } from 'shared';

vi.mock('../../config/frontendAgent.config', () => ({
  frontendAgentConfig: { MAX_CONTEXT_TOKENS: 12000, MAX_FILE_CONTEXT_SIZE: 20000 },
}));

vi.mock('../../services/files/file-tree.service', () => ({
  getFileTree: vi.fn(),
}));

vi.mock('../../services/workspace/virtual-file-system.service', () => ({
  readFile: vi.fn(),
}));

vi.mock('../context/project-context.service', () => ({
  loadProject: vi.fn(),
  loadManifest: vi.fn(),
}));

import * as fileTreeService from '../../services/files/file-tree.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import * as contextService from '../context/project-context.service';
import { buildFrontendContext } from './frontend.context';

const project = {
  _id: new Types.ObjectId(),
  name: 'todo-list',
  description: 'desc',
  frontend: 'React',
  backend: 'Express',
  database: 'MongoDB',
  authentication: 'Clerk',
  styling: 'Tailwind',
  deployment: 'Vercel',
};

function fileNode(path: string) {
  return { path, type: FileEntryType.FILE, name: path.split('/').pop()! };
}

function task(overrides: Partial<IPlanTask> & { id: string }): IPlanTask {
  return {
    title: overrides.id,
    description: '',
    type: 'frontend',
    priority: 'medium',
    complexity: 'small',
    dependencies: [],
    affectedFiles: [],
    acceptanceCriteria: [],
    ...overrides,
  } as IPlanTask;
}

describe('buildFrontendContext', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contextService.loadProject).mockResolvedValue(project as never);
    vi.mocked(contextService.loadManifest).mockResolvedValue(null as never);
  });

  it("includes a dependency task's affected files, not just this task's own", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([
      fileNode('src/components/TaskInput.tsx'),
      fileNode('src/components/TaskList.tsx'),
    ] as never);
    vi.mocked(vfs.readFile).mockImplementation(async (_owner, _projectId, path: string) => ({
      content: `// content of ${path}`,
    }) as never);

    const taskInput = task({ id: 'TASK-001', affectedFiles: ['src/components/TaskInput.tsx'] });
    const taskList = task({
      id: 'TASK-002',
      affectedFiles: ['src/components/TaskList.tsx'],
      dependencies: ['TASK-001'],
    });

    const context = await buildFrontendContext(owner, 'p1', taskList, [taskInput, taskList]);

    const paths = context.relevantFiles.map((file) => file.path);
    expect(paths).toContain('src/components/TaskList.tsx');
    expect(paths).toContain('src/components/TaskInput.tsx');
  });

  it("does not pull in a non-dependency task's files", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([
      fileNode('src/components/TaskInput.tsx'),
      fileNode('src/components/TaskList.tsx'),
      fileNode('src/components/Unrelated.tsx'),
    ] as never);
    vi.mocked(vfs.readFile).mockImplementation(async (_owner, _projectId, path: string) => ({
      content: `// content of ${path}`,
    }) as never);

    const taskInput = task({ id: 'TASK-001', affectedFiles: ['src/components/TaskInput.tsx'] });
    const unrelated = task({ id: 'TASK-003', affectedFiles: ['src/components/Unrelated.tsx'] });
    const taskList = task({
      id: 'TASK-002',
      affectedFiles: ['src/components/TaskList.tsx'],
      dependencies: ['TASK-001'],
    });

    const context = await buildFrontendContext(owner, 'p1', taskList, [taskInput, unrelated, taskList]);

    expect(context.relevantFiles.map((file) => file.path)).not.toContain('src/components/Unrelated.tsx');
  });

  it("skips a dependency's affected file that doesn't exist in the project yet", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([fileNode('src/components/TaskList.tsx')] as never);
    vi.mocked(vfs.readFile).mockResolvedValue({ content: 'x' } as never);

    const taskInput = task({ id: 'TASK-001', affectedFiles: ['src/components/TaskInput.tsx'] });
    const taskList = task({
      id: 'TASK-002',
      affectedFiles: ['src/components/TaskList.tsx'],
      dependencies: ['TASK-001'],
    });

    const context = await buildFrontendContext(owner, 'p1', taskList, [taskInput, taskList]);

    expect(context.relevantFiles.map((file) => file.path)).not.toContain('src/components/TaskInput.tsx');
  });
});
