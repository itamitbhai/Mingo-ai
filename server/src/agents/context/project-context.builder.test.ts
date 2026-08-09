import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('./project-context.service', () => ({
  loadProject: vi.fn(),
  loadWorkspace: vi.fn(),
  loadManifest: vi.fn(),
  loadFiles: vi.fn(),
  loadRecentChanges: vi.fn(),
  loadConversationMessages: vi.fn(),
}));

import * as contextService from './project-context.service';
import { buildPlannerContext } from './project-context.builder';

const project = {
  _id: new Types.ObjectId(),
  name: 'Test Project',
  description: 'desc',
  frontend: 'React',
  backend: 'Express',
  database: 'MongoDB',
  authentication: 'Clerk',
  styling: 'Tailwind',
  deployment: 'Vercel',
};

describe('buildPlannerContext', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contextService.loadProject).mockResolvedValue(project as never);
    vi.mocked(contextService.loadWorkspace).mockResolvedValue({ status: 'ready', activeVersion: 3 } as never);
    vi.mocked(contextService.loadManifest).mockResolvedValue({
      projectId: project._id.toString(),
      framework: 'React',
      language: 'TypeScript',
      packageManager: 'npm',
      files: 10,
      folders: 3,
      entryPoints: ['src/main.tsx'],
      dependencies: { react: '^19' },
      devDependencies: {},
    } as never);
    vi.mocked(contextService.loadFiles).mockResolvedValue([{ path: 'src/App.tsx', type: 'file', language: 'typescript' }]);
    vi.mocked(contextService.loadRecentChanges).mockResolvedValue(['Created src/App.tsx']);
    vi.mocked(contextService.loadConversationMessages).mockResolvedValue([{ role: 'user', content: 'hi' }]);
  });

  it('composes every loader into the PlannerContext shape', async () => {
    const conversationId = new Types.ObjectId().toString();
    const context = await buildPlannerContext(owner, 'p1', conversationId);

    expect(context.project).toMatchObject({ id: project._id.toString(), name: 'Test Project', frontend: 'React' });
    expect(context.workspace).toEqual({ status: 'ready', activeVersion: 3 });
    expect(context.manifest).toMatchObject({ framework: 'React', files: 10 });
    expect(context.files).toEqual([{ path: 'src/App.tsx', type: 'file', language: 'typescript' }]);
    expect(context.dependencies).toEqual({ dependencies: { react: '^19' }, devDependencies: {} });
    expect(context.recentChanges).toEqual(['Created src/App.tsx']);
    expect(context.conversation).toEqual([{ role: 'user', content: 'hi' }]);

    expect(contextService.loadConversationMessages).toHaveBeenCalledWith(expect.any(Types.ObjectId));
  });

  it('skips loading conversation messages when no conversationId is given', async () => {
    const context = await buildPlannerContext(owner, 'p1');

    expect(context.conversation).toEqual([]);
    expect(contextService.loadConversationMessages).not.toHaveBeenCalled();
  });

  it('degrades gracefully to null/empty when workspace/manifest loaders fail', async () => {
    vi.mocked(contextService.loadWorkspace).mockRejectedValue(new Error('workspace not ready'));
    vi.mocked(contextService.loadManifest).mockRejectedValue(new Error('manifest failed'));
    vi.mocked(contextService.loadFiles).mockRejectedValue(new Error('files failed'));
    vi.mocked(contextService.loadRecentChanges).mockRejectedValue(new Error('activity failed'));

    const context = await buildPlannerContext(owner, 'p1');

    expect(context.workspace).toBeNull();
    expect(context.manifest).toBeNull();
    expect(context.files).toEqual([]);
    expect(context.recentChanges).toEqual([]);
    expect(context.dependencies).toEqual({});
  });

  it('propagates a real error when the project itself cannot be loaded (ownership failure)', async () => {
    vi.mocked(contextService.loadProject).mockRejectedValue(
      Object.assign(new Error('Project not found'), { statusCode: 404 })
    );

    await expect(buildPlannerContext(owner, 'p1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
