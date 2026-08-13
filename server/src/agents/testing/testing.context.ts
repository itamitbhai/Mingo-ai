import { Types } from 'mongoose';
import { AgentGenerationStatus, FileEntryType, IApiContract, IPlanTask } from 'shared';
import { testingAgentConfig } from '../../config/testingAgent.config';
import { AgentGenerationDocument, AgentGenerationModel } from '../../models';
import * as fileTreeService from '../../services/files/file-tree.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import * as contextService from '../context/project-context.service';
import * as databaseAgentService from '../database/database.service';
import { isForbiddenPath } from './testing.security';
import { TestingAgentContext, TestingContextFile } from './testing.types';

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

const TEST_FILE_PATTERN = /(\.(test|spec)\.[jt]sx?$)|((^|\/)(__tests__|tests|e2e)\/)/i;

/** Testing-specific convention samples (spec §9): package.json (dependency/tooling context) and an
 *  existing test config file if one exists — mirrors `database.context.ts`'s
 *  `pickConventionSamples`. */
const CONVENTION_SAMPLE_PATTERNS = [/package\.json$/i, /(vitest|jest|playwright)\.config\.[jt]s$/i];

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
 * Gathers the Backend Agent's already-implemented API contracts for this plan — same shape as
 * `database.service.ts`'s `loadBackendApiContracts`, kept as its own small copy here rather than a
 * shared cross-agent module: every agent's `*.security.ts`/`*.context.ts` already duplicates its
 * small helpers rather than sharing them, and reusing `database.service`'s internal (unexported)
 * helper would mean either exporting it or importing across agent boundaries for a ~15-line function.
 */
async function loadBackendApiContracts(plan: Types.ObjectId): Promise<IApiContract[]> {
  const generations = await AgentGenerationModel.find({
    plan,
    agentType: 'backend',
    status: { $in: [AgentGenerationStatus.COMPLETED, AgentGenerationStatus.PREVIEW_READY] },
  }).sort({ version: -1 });

  const latestByTask = new Map<string, AgentGenerationDocument>();
  for (const generation of generations) {
    if (!latestByTask.has(generation.taskId)) {
      latestByTask.set(generation.taskId, generation);
    }
  }

  const contractsByKey = new Map<string, IApiContract>();
  for (const generation of latestByTask.values()) {
    for (const contract of generation.apiContracts ?? []) {
      contractsByKey.set(`${contract.method.toUpperCase()} ${contract.path}`, contract);
    }
  }

  return Array.from(contractsByKey.values());
}

/**
 * Builds the Testing Agent's context (Phase 9 spec §7/§9): existing files' actual *content* scoped to
 * the task's `affectedFiles`, its dependency tasks' `affectedFiles`, and a few testing convention
 * samples, plus the real Backend API contracts and Database schema contracts this plan has already
 * produced — mirrors `database.context.ts`'s `buildDatabaseContext` exactly.
 */
export async function buildTestingContext(
  owner: Types.ObjectId,
  projectId: string,
  task: IPlanTask,
  allTasks: IPlanTask[],
  planId: Types.ObjectId,
  feedback?: string
): Promise<TestingAgentContext> {
  const project = await contextService.loadProject(owner, projectId);
  const manifest = await contextService.loadManifest(owner, projectId).catch(() => null);

  const tree = await fileTreeService.getFileTree(owner, projectId).catch(() => []);
  const allPaths = flattenFilePaths(tree);
  const existingPaths = allPaths.filter((path) => !isForbiddenPath(path));
  const existingPathSet = new Set(existingPaths);
  const existingTestFiles = existingPaths.filter((path) => TEST_FILE_PATTERN.test(path));

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

  const relevantFiles: TestingContextFile[] = [];
  let budgetRemaining = testingAgentConfig.MAX_CONTEXT_TOKENS;

  for (const path of candidatePaths) {
    if (relevantFiles.some((file) => file.path === path)) continue;
    if (budgetRemaining <= 0) break;

    const content = await vfs.readFile(owner, projectId, path).then(
      (file) => file.content,
      () => null
    );
    if (content === null) continue;

    const truncated = content.slice(0, Math.min(testingAgentConfig.MAX_FILE_CONTEXT_SIZE, budgetRemaining));
    relevantFiles.push({ path, content: truncated });
    budgetRemaining -= truncated.length;
  }

  const [backendApiContracts, databaseSchemaContracts] = await Promise.all([
    loadBackendApiContracts(planId),
    databaseAgentService.getProjectDatabaseSchema(owner, projectId).catch(() => []),
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
          scripts: manifest.scripts,
        }
      : null,
    task,
    relevantFiles,
    existingTestFiles,
    existingPaths,
    backendApiContracts,
    databaseSchemaContracts,
    feedback,
  };
}
