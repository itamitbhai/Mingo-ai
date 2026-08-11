import { Types } from 'mongoose';
import { FileEntryType, IPlanApiEndpoint, IPlanTask } from 'shared';
import { backendAgentConfig } from '../../config/backendAgent.config';
import * as fileTreeService from '../../services/files/file-tree.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import * as contextService from '../context/project-context.service';
import { isForbiddenPath } from './backend.security';
import { BackendAgentContext, BackendContextFile } from './backend.types';

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

/** Backend-specific convention samples (spec §9/§13/§30/§48/§49): package.json (dependency/tooling
 *  context), the server entry point (route-registration conventions, spec §48), an existing route
 *  file, and an existing error-handling middleware (spec §17/§49) — so the agent reuses what's
 *  there instead of inventing a second one. Each pattern contributes at most one file, and only if
 *  it isn't already covered by the task's own `affectedFiles`, mirroring
 *  `frontend.context.ts`'s `pickConventionSamples`. */
const CONVENTION_SAMPLE_PATTERNS = [
  /package\.json$/i,
  /(^|\/)(app|server|index|main)\.(js|ts)$/i,
  /middlewares?\/.*error.*\.(js|ts)$/i,
  /routes?\/.*\.(js|ts)$/i,
];

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
 * Builds the Backend Agent's context (Phase 7 spec §9/§12/§13): existing files' actual *content*
 * scoped to the task's `affectedFiles`, its dependency tasks' `affectedFiles`, and a few backend
 * convention samples — filtered through `isForbiddenPath` first and capped by
 * `MAX_FILE_CONTEXT_SIZE`/`MAX_CONTEXT_TOKENS`, mirroring `frontend.context.ts`'s
 * `buildFrontendContext` exactly.
 *
 * `apiEndpoints` (the Planner's approved `ProjectPlan.api`, if any) is passed through so the agent
 * implements the exact approved contract instead of inventing routes (spec §12/§24/§25) — dependency
 * files matter for the same reason they do for the Frontend Agent: `checkDependencies`
 * (backend.service.ts) already guarantees every dependency task is `COMPLETED` before this one can
 * run, so an earlier task's real, applied service/model file is available to read rather than guess.
 */
export async function buildBackendContext(
  owner: Types.ObjectId,
  projectId: string,
  task: IPlanTask,
  allTasks: IPlanTask[],
  apiEndpoints: IPlanApiEndpoint[] = [],
  feedback?: string
): Promise<BackendAgentContext> {
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

  const relevantFiles: BackendContextFile[] = [];
  let budgetRemaining = backendAgentConfig.MAX_CONTEXT_TOKENS;

  for (const path of candidatePaths) {
    if (relevantFiles.some((file) => file.path === path)) continue;
    if (budgetRemaining <= 0) break;

    const content = await vfs.readFile(owner, projectId, path).then(
      (file) => file.content,
      () => null
    );
    if (content === null) continue;

    const truncated = content.slice(0, Math.min(backendAgentConfig.MAX_FILE_CONTEXT_SIZE, budgetRemaining));
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
    apiEndpoints: apiEndpoints.map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      purpose: endpoint.purpose,
      authRequired: endpoint.authRequired,
      requestSummary: endpoint.requestSummary,
      responseSummary: endpoint.responseSummary,
    })),
    feedback,
  };
}
