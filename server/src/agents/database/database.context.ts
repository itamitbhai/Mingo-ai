import { Types } from 'mongoose';
import { FileEntryType, IApiContract, IPlanDatabase, IPlanTask } from 'shared';
import { databaseAgentConfig } from '../../config/databaseAgent.config';
import * as fileTreeService from '../../services/files/file-tree.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import * as contextService from '../context/project-context.service';
import { buildRequiredFieldPlan } from './database.planner';
import { isForbiddenPath } from './database.security';
import { DatabaseAgentContext, DatabaseContextFile } from './database.types';

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

/** Database-specific convention samples (spec §9/§21/§22/§24): package.json (dependency/tooling
 *  context), the database connection module (spec §21/§22 — reuse, never duplicate), and an
 *  existing model file (naming/validation/index conventions). Mirrors
 *  `backend.context.ts`'s `pickConventionSamples` — each pattern contributes at most one file, and
 *  only if it isn't already covered by the task's own `affectedFiles`. */
const CONVENTION_SAMPLE_PATTERNS = [
  /package\.json$/i,
  /(^|\/)(database|db)[/-]?(config|connection|index)\.(js|ts)$/i,
  /models?\/.*\.(js|ts)$/i,
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
 * Builds the Database Agent's context (Phase 8 spec §9/§13): existing files' actual *content*
 * scoped to the task's `affectedFiles`, its dependency tasks' `affectedFiles`, and a few database
 * convention samples — filtered through `isForbiddenPath` first and capped by
 * `MAX_FILE_CONTEXT_SIZE`/`MAX_CONTEXT_TOKENS`, mirroring `backend.context.ts`'s
 * `buildBackendContext` exactly.
 *
 * `planDatabase` (the Planner's approved `ProjectPlan.database`) and `backendApiContracts` (every
 * `apiContracts` entry from this plan's already-run Backend Agent generations, gathered by
 * `database.service.ts`) are the two sources `database.planner.buildRequiredFieldPlan` merges into
 * `requiredFieldPlan` — handed to the prompt directly so the model doesn't have to re-derive it.
 */
export async function buildDatabaseContext(
  owner: Types.ObjectId,
  projectId: string,
  task: IPlanTask,
  allTasks: IPlanTask[],
  planDatabase: IPlanDatabase | null,
  backendApiContracts: IApiContract[],
  feedback?: string
): Promise<DatabaseAgentContext> {
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

  const relevantFiles: DatabaseContextFile[] = [];
  let budgetRemaining = databaseAgentConfig.MAX_CONTEXT_TOKENS;

  for (const path of candidatePaths) {
    if (relevantFiles.some((file) => file.path === path)) continue;
    if (budgetRemaining <= 0) break;

    const content = await vfs.readFile(owner, projectId, path).then(
      (file) => file.content,
      () => null
    );
    if (content === null) continue;

    const truncated = content.slice(0, Math.min(databaseAgentConfig.MAX_FILE_CONTEXT_SIZE, budgetRemaining));
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
    planDatabase,
    backendApiContracts,
    requiredFieldPlan: buildRequiredFieldPlan(planDatabase, backendApiContracts),
    feedback,
  };
}
