import { Types } from 'mongoose';
import { FileEntryType, IPlanTask } from 'shared';
import { frontendAgentConfig } from '../../config/frontendAgent.config';
import * as fileTreeService from '../../services/files/file-tree.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import * as contextService from '../context/project-context.service';
import { isForbiddenPath } from './frontend.security';
import { FrontendAgentContext, FrontendContextFile } from './frontend.types';

type FileTreeNode = Awaited<ReturnType<typeof fileTreeService.getFileTree>>[number];

function flattenFilePaths(nodes: FileTreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === FileEntryType.FILE) {
      acc.push(node.path);
    }
    if (node.children?.length) {
      flattenFilePaths(node.children, acc);
    }
  }
  return acc;
}

const CONVENTION_SAMPLE_PATTERNS = [/package\.json$/i, /\.(tsx|jsx)$/i];

/** Picks a small, fixed set of "convention sample" files beyond the task's own `affectedFiles` —
 *  package.json (dependency/tooling context) plus one existing component (naming/style
 *  conventions) — never more than a couple, so context stays bounded (spec §13). */
function pickConventionSamples(existingPaths: string[], alreadyPicked: Set<string>): string[] {
  const samples: string[] = [];

  for (const pattern of CONVENTION_SAMPLE_PATTERNS) {
    const match = existingPaths.find((path) => pattern.test(path) && !alreadyPicked.has(path));
    if (match) {
      samples.push(match);
      alreadyPicked.add(match);
    }
  }

  return samples;
}

/**
 * Builds the Frontend Agent's context (spec §12/§13): existing files' actual *content* (unlike the
 * Planner's metadata-only context), scoped to the task's `affectedFiles`, its dependency tasks'
 * `affectedFiles`, and a couple of convention samples — filtered through `isForbiddenPath` first
 * and capped by `MAX_FILE_CONTEXT_SIZE`/`MAX_CONTEXT_TOKENS` so the whole project is never sent to
 * the AI.
 *
 * Dependency files matter because `checkDependencies` (frontend.service.ts) already guarantees
 * every dependency task is `COMPLETED` before this one can run — their output is real, applied
 * files by now. Without reading them, a task that imports a sibling component built by an earlier
 * task (e.g. a list composing an already-built input component) has no way to see its actual props
 * and has to guess, which is how cross-file interface mismatches happen.
 */
export async function buildFrontendContext(
  owner: Types.ObjectId,
  projectId: string,
  task: IPlanTask,
  allTasks: IPlanTask[],
  feedback?: string
): Promise<FrontendAgentContext> {
  const project = await contextService.loadProject(owner, projectId);
  const manifest = await contextService.loadManifest(owner, projectId).catch(() => null);

  const tree = await fileTreeService.getFileTree(owner, projectId).catch(() => []);
  const existingPaths = flattenFilePaths(tree).filter((path) => !isForbiddenPath(path));
  const existingPathSet = new Set(existingPaths);

  const dependencyIds = new Set(task.dependencies);
  const dependencyAffectedFiles = allTasks
    .filter((candidate) => dependencyIds.has(candidate.id))
    .flatMap((dependencyTask) => dependencyTask.affectedFiles);

  const alreadyPicked = new Set<string>();
  const candidatePaths = [
    ...task.affectedFiles.filter((path) => !isForbiddenPath(path) && existingPathSet.has(path)),
    ...dependencyAffectedFiles.filter((path) => !isForbiddenPath(path) && existingPathSet.has(path)),
    ...pickConventionSamples(existingPaths, alreadyPicked),
  ];

  const relevantFiles: FrontendContextFile[] = [];
  let budgetRemaining = frontendAgentConfig.MAX_CONTEXT_TOKENS;

  for (const path of candidatePaths) {
    if (relevantFiles.some((file) => file.path === path)) continue;
    if (budgetRemaining <= 0) break;

    const content = await vfs.readFile(owner, projectId, path).then(
      (file) => file.content,
      () => null
    );
    if (content === null) continue;

    const truncated = content.slice(0, Math.min(frontendAgentConfig.MAX_FILE_CONTEXT_SIZE, budgetRemaining));
    relevantFiles.push({ path, content: truncated });
    budgetRemaining -= truncated.length;
  }

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
    manifest: manifest
      ? {
          framework: manifest.framework,
          language: manifest.language,
          packageManager: manifest.packageManager,
          files: manifest.files,
          folders: manifest.folders,
          entryPoints: manifest.entryPoints,
          dependencies: manifest.dependencies,
          devDependencies: manifest.devDependencies,
        }
      : null,
    task,
    relevantFiles,
    existingPaths,
    feedback,
  };
}
