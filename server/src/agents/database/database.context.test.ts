import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType, IPlanTask } from 'shared';

vi.mock('../../config/databaseAgent.config', () => ({
  databaseAgentConfig: { MAX_CONTEXT_TOKENS: 12000, MAX_FILE_CONTEXT_SIZE: 20000 },
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
import { buildDatabaseContext } from './database.context';

const project = {
  _id: new Types.ObjectId(),
  name: 'todo-db',
  description: 'desc',
  frontend: 'React',
  backend: 'Express',
  database: 'MongoDB',
  authentication: 'JWT',
  styling: 'Tailwind',
  deployment: 'Railway',
};

function fileNode(path: string) {
  return { path, type: FileEntryType.FILE, name: path.split('/').pop()! };
}

function task(overrides: Partial<IPlanTask> & { id: string }): IPlanTask {
  return {
    title: overrides.id,
    description: '',
    type: 'database',
    priority: 'medium',
    complexity: 'small',
    dependencies: [],
    affectedFiles: [],
    acceptanceCriteria: [],
    ...overrides,
  } as IPlanTask;
}

describe('buildDatabaseContext', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contextService.loadProject).mockResolvedValue(project as never);
    vi.mocked(contextService.loadManifest).mockResolvedValue(null as never);
  });

  it("includes a dependency task's affected files, not just this task's own", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([
      fileNode('server/database/connection.js'),
      fileNode('server/models/Todo.js'),
    ] as never);
    vi.mocked(vfs.readFile).mockImplementation(async (_owner, _projectId, path: string) => ({
      content: `// content of ${path}`,
    }) as never);

    const connectionTask = task({ id: 'TASK-009', affectedFiles: ['server/database/connection.js'] });
    const modelTask = task({
      id: 'TASK-010',
      affectedFiles: ['server/models/Todo.js'],
      dependencies: ['TASK-009'],
    });

    const context = await buildDatabaseContext(owner, 'p1', modelTask, [connectionTask, modelTask], null, []);

    const paths = context.relevantFiles.map((file) => file.path);
    expect(paths).toContain('server/models/Todo.js');
    expect(paths).toContain('server/database/connection.js');
  });

  it("does not pull in a non-dependency task's files", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([
      fileNode('server/database/connection.js'),
      fileNode('server/models/Todo.js'),
      fileNode('server/utils/color-helpers.js'),
    ] as never);
    vi.mocked(vfs.readFile).mockImplementation(async (_owner, _projectId, path: string) => ({
      content: `// content of ${path}`,
    }) as never);

    const connectionTask = task({ id: 'TASK-009', affectedFiles: ['server/database/connection.js'] });
    const unrelated = task({ id: 'TASK-020', affectedFiles: ['server/utils/color-helpers.js'] });
    const modelTask = task({
      id: 'TASK-010',
      affectedFiles: ['server/models/Todo.js'],
      dependencies: ['TASK-009'],
    });

    const context = await buildDatabaseContext(owner, 'p1', modelTask, [connectionTask, unrelated, modelTask], null, []);

    expect(context.relevantFiles.map((file) => file.path)).not.toContain('server/utils/color-helpers.js');
  });

  it("skips a dependency's affected file that doesn't exist in the project yet", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([fileNode('server/models/Todo.js')] as never);
    vi.mocked(vfs.readFile).mockResolvedValue({ content: 'x' } as never);

    const connectionTask = task({ id: 'TASK-009', affectedFiles: ['server/database/connection.js'] });
    const modelTask = task({
      id: 'TASK-010',
      affectedFiles: ['server/models/Todo.js'],
      dependencies: ['TASK-009'],
    });

    const context = await buildDatabaseContext(owner, 'p1', modelTask, [connectionTask, modelTask], null, []);

    expect(context.relevantFiles.map((file) => file.path)).not.toContain('server/database/connection.js');
  });

  it('derives requiredFieldPlan from planDatabase and backendApiContracts', async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([] as never);

    const modelTask = task({ id: 'TASK-010' });
    const context = await buildDatabaseContext(
      owner,
      'p1',
      modelTask,
      [modelTask],
      { entities: [{ name: 'Todo', fields: [{ name: 'title', type: 'string', required: true }] }], relationships: [] },
      [{ method: 'POST', path: '/api/todos', authentication: true, request: { completed: 'boolean' } }]
    );

    const todo = context.requiredFieldPlan.find((entry) => entry.model === 'Todo');
    expect(todo?.requiredFields).toEqual(expect.arrayContaining(['title', 'completed']));
  });
});
