import { Types } from 'mongoose';
import { PlannerContext } from '../planner/planner.types';
import * as contextService from './project-context.service';

/**
 * Composes the Planner's `{project, workspace, manifest, files, dependencies, recentChanges,
 * conversation}` context (spec §7). `project` must resolve (a missing/unowned project is a real
 * error); everything else degrades gracefully to an empty/null value so a project that hasn't
 * finished Phase 4 workspace initialization still gets a plan instead of a hard failure.
 */
export async function buildPlannerContext(
  owner: Types.ObjectId,
  projectId: string,
  conversationId?: string
): Promise<PlannerContext> {
  const project = await contextService.loadProject(owner, projectId);

  const [workspace, manifest, files, recentChanges, conversation] = await Promise.all([
    contextService.loadWorkspace(owner, project._id, project.frontend).catch(() => null),
    contextService.loadManifest(owner, projectId).catch(() => null),
    contextService.loadFiles(owner, projectId).catch(() => []),
    contextService.loadRecentChanges(owner, project._id).catch(() => []),
    conversationId
      ? contextService.loadConversationMessages(new Types.ObjectId(conversationId)).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    project: {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      frontend: project.frontend,
      backend: project.backend,
      database: project.database,
      authentication: project.authentication,
      styling: project.styling,
      deployment: project.deployment,
    },
    workspace: workspace ? { status: workspace.status, activeVersion: workspace.activeVersion } : null,
    manifest: manifest
      ? {
          framework: manifest.framework,
          language: manifest.language,
          packageManager: manifest.packageManager,
          files: manifest.files,
          folders: manifest.folders,
          entryPoints: manifest.entryPoints,
        }
      : null,
    files,
    dependencies: manifest
      ? { dependencies: manifest.dependencies, devDependencies: manifest.devDependencies }
      : {},
    recentChanges,
    conversation,
  };
}
