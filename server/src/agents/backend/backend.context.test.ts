import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FileEntryType, IPlanTask } from 'shared';

vi.mock('../../config/backendAgent.config', () => ({
  backendAgentConfig: { MAX_CONTEXT_TOKENS: 12000, MAX_FILE_CONTEXT_SIZE: 20000 },
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
import { buildBackendContext } from './backend.context';

const project = {
  _id: new Types.ObjectId(),
  name: 'todo-api',
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
    type: 'backend',
    priority: 'medium',
    complexity: 'small',
    dependencies: [],
    affectedFiles: [],
    acceptanceCriteria: [],
    ...overrides,
  } as IPlanTask;
}

describe('buildBackendContext', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contextService.loadProject).mockResolvedValue(project as never);
    vi.mocked(contextService.loadManifest).mockResolvedValue(null as never);
  });

  it("includes a dependency task's affected files, not just this task's own", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([
      fileNode('server/models/todo.model.js'),
      fileNode('server/services/todo.service.js'),
    ] as never);
    vi.mocked(vfs.readFile).mockImplementation(async (_owner, _projectId, path: string) => ({
      content: `// content of ${path}`,
    }) as never);

    const modelTask = task({ id: 'TASK-010', affectedFiles: ['server/models/todo.model.js'] });
    const serviceTask = task({
      id: 'TASK-011',
      affectedFiles: ['server/services/todo.service.js'],
      dependencies: ['TASK-010'],
    });

    const context = await buildBackendContext(owner, 'p1', serviceTask, [modelTask, serviceTask]);

    const paths = context.relevantFiles.map((file) => file.path);
    expect(paths).toContain('server/services/todo.service.js');
    expect(paths).toContain('server/models/todo.model.js');
  });

  it("does not pull in a non-dependency task's files", async () => {
    // Deliberately doesn't match any of `backend.context.ts`'s convention-sample patterns
    // (package.json / entry point / error middleware / a route file) — otherwise it would
    // legitimately be picked as a convention sample regardless of task ownership.
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([
      fileNode('server/models/todo.model.js'),
      fileNode('server/services/todo.service.js'),
      fileNode('server/utils/color-helpers.js'),
    ] as never);
    vi.mocked(vfs.readFile).mockImplementation(async (_owner, _projectId, path: string) => ({
      content: `// content of ${path}`,
    }) as never);

    const modelTask = task({ id: 'TASK-010', affectedFiles: ['server/models/todo.model.js'] });
    const unrelated = task({ id: 'TASK-020', affectedFiles: ['server/utils/color-helpers.js'] });
    const serviceTask = task({
      id: 'TASK-011',
      affectedFiles: ['server/services/todo.service.js'],
      dependencies: ['TASK-010'],
    });

    const context = await buildBackendContext(owner, 'p1', serviceTask, [modelTask, unrelated, serviceTask]);

    expect(context.relevantFiles.map((file) => file.path)).not.toContain('server/utils/color-helpers.js');
  });

  it("skips a dependency's affected file that doesn't exist in the project yet", async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([fileNode('server/services/todo.service.js')] as never);
    vi.mocked(vfs.readFile).mockResolvedValue({ content: 'x' } as never);

    const modelTask = task({ id: 'TASK-010', affectedFiles: ['server/models/todo.model.js'] });
    const serviceTask = task({
      id: 'TASK-011',
      affectedFiles: ['server/services/todo.service.js'],
      dependencies: ['TASK-010'],
    });

    const context = await buildBackendContext(owner, 'p1', serviceTask, [modelTask, serviceTask]);

    expect(context.relevantFiles.map((file) => file.path)).not.toContain('server/models/todo.model.js');
  });

  it('passes the approved API endpoints through to the context', async () => {
    vi.mocked(fileTreeService.getFileTree).mockResolvedValue([] as never);

    const apiTask = task({ id: 'TASK-011' });
    const context = await buildBackendContext(owner, 'p1', apiTask, [apiTask], [
      { method: 'GET', path: '/api/todos', purpose: 'List todos', authRequired: true },
    ]);

    expect(context.apiEndpoints).toEqual([
      {
        method: 'GET',
        path: '/api/todos',
        purpose: 'List todos',
        authRequired: true,
        requestSummary: undefined,
        responseSummary: undefined,
      },
    ]);
  });
});
