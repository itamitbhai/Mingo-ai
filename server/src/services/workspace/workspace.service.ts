import { Types } from 'mongoose';
import { FileEntryType, FrontendStack, IWorkspaceManifest, WorkspaceStatus } from 'shared';
import { ProjectFileModel, ProjectWorkspaceModel } from '../../models';
import { isDuplicateKeyError } from '../../utils/mongoErrors';
import { getProjectById } from '../project.service';

/** Get-or-create — idempotent, so it's safe to call both at project creation and lazily on first
 *  workspace access if seeding failed earlier (spec §14/§20). */
export async function ensureWorkspace(owner: Types.ObjectId, project: Types.ObjectId, framework?: string) {
  const existing = await ProjectWorkspaceModel.findOne({ project, owner });
  if (existing) return existing;

  try {
    return await ProjectWorkspaceModel.create({
      project,
      owner,
      status: WorkspaceStatus.READY,
      activeVersion: 1,
      lastOpenedAt: new Date(),
      lastModifiedAt: new Date(),
      metadata: framework ? { framework } : undefined,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const workspace = await ProjectWorkspaceModel.findOne({ project, owner });
      if (workspace) return workspace;
    }
    throw err;
  }
}

export async function getWorkspace(owner: Types.ObjectId, projectId: string) {
  const project = await getProjectById(owner, projectId);
  const workspace = await ensureWorkspace(owner, project._id, project.frontend);
  return workspace;
}

/** Best-effort bookkeeping called after a mutation — never blocks the primary write on failure. */
export async function touchWorkspace(
  owner: Types.ObjectId,
  project: Types.ObjectId,
  status: WorkspaceStatus = WorkspaceStatus.READY
) {
  await ProjectWorkspaceModel.updateOne(
    { project, owner },
    { $set: { lastModifiedAt: new Date(), status }, $inc: { activeVersion: 1 } },
    { upsert: false }
  ).catch(() => undefined);
}

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  packageManager?: string;
}

function parsePackageJson(content: string): PackageJsonShape | undefined {
  try {
    return JSON.parse(content) as PackageJsonShape;
  } catch {
    return undefined;
  }
}

const ENTRY_POINT_CANDIDATES: Partial<Record<FrontendStack, string[]>> = {
  [FrontendStack.REACT]: ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx'],
  [FrontendStack.NEXTJS]: ['app/page.tsx', 'app/page.jsx', 'pages/index.tsx', 'pages/index.jsx'],
  [FrontendStack.VUE]: ['src/main.js', 'src/main.ts'],
};

/** Everything here is computed live from the project's actual `ProjectFile` documents — never
 *  fabricated (spec §31). */
export async function getManifest(owner: Types.ObjectId, projectId: string): Promise<IWorkspaceManifest> {
  const project = await getProjectById(owner, projectId);
  const candidates = ENTRY_POINT_CANDIDATES[project.frontend] ?? [];

  const [fileCount, folderCount, hasTypeScript, entryPointDocs, packageJsonDoc] = await Promise.all([
    ProjectFileModel.countDocuments({ project: project._id, owner, type: FileEntryType.FILE }),
    ProjectFileModel.countDocuments({ project: project._id, owner, type: FileEntryType.FOLDER }),
    ProjectFileModel.exists({ project: project._id, owner, language: 'typescript' }),
    candidates.length
      ? ProjectFileModel.find({ project: project._id, owner, path: { $in: candidates } }).select('path')
      : Promise.resolve([]),
    ProjectFileModel.findOne({
      project: project._id,
      owner,
      path: 'package.json',
      type: FileEntryType.FILE,
    }).select('content'),
  ]);

  const packageJson = packageJsonDoc ? parsePackageJson(packageJsonDoc.content) : undefined;

  return {
    projectId: project._id.toString(),
    framework: project.frontend,
    language: hasTypeScript ? 'TypeScript' : 'JavaScript',
    packageManager: packageJson?.packageManager?.split('@')[0] ?? 'npm',
    files: fileCount,
    folders: folderCount,
    entryPoints: entryPointDocs.map((doc) => doc.path),
    dependencies: packageJson?.dependencies,
    devDependencies: packageJson?.devDependencies,
    scripts: packageJson?.scripts,
  };
}
