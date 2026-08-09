import { Types } from 'mongoose';
import { detectLanguage, detectMimeType, FileChangeType, FileEntryType, isBinaryFile } from 'shared';
import { ProjectFileDocument, ProjectFileModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { computeChecksum } from '../../utils/checksum';
import { isDuplicateKeyError } from '../../utils/mongoErrors';
import { getProjectById } from '../project.service';
import { workspaceCache } from '../workspace/cache.service';
import { moveOrRenameEntry } from '../workspace/move.service';
import { recordVersion } from '../workspace/version.service';
import { logActivity } from '../workspace/workspace-activity.service';
import { touchWorkspace } from '../workspace/workspace.service';
import { assertSafePath, escapeRegExp, getBaseName, getParentPath } from './file-validation.service';

async function assertProjectOwnership(owner: Types.ObjectId, projectId: string) {
  return getProjectById(owner, projectId);
}

async function assertParentFolderExists(
  project: Types.ObjectId,
  owner: Types.ObjectId,
  parentPath: string
) {
  const parent = await ProjectFileModel.findOne({
    project,
    owner,
    path: parentPath,
    type: FileEntryType.FOLDER,
  });

  if (!parent) {
    throw ApiError.badRequest('Parent folder does not exist');
  }
}

/**
 * Records a `ProjectFileVersion` history entry + a `WorkspaceActivity` log line for every mutation,
 * then invalidates the project's cached tree/manifest and bumps the workspace's `activeVersion`.
 * This is what makes the existing `/files` and `/folders` endpoints (used by the live Monaco IDE)
 * produce real version history for free — there's one filesystem, not a parallel one for AI agents.
 */
async function recordChange(
  projectId: Types.ObjectId,
  file: ProjectFileDocument,
  changeType: FileChangeType,
  changedBy: Types.ObjectId,
  description: string
): Promise<void> {
  const checksum = file.checksum ?? computeChecksum(file.content ?? '');

  await Promise.all([
    recordVersion({
      file: file._id,
      project: projectId,
      owner: changedBy,
      version: file.version,
      content: file.content ?? '',
      checksum,
      changedBy,
      changeType,
    }),
    logActivity({
      project: projectId,
      user: changedBy,
      file: file._id,
      action: changeType,
      description,
    }),
  ]);

  workspaceCache.invalidate(projectId.toString());
  await touchWorkspace(changedBy, projectId);
}

export async function getFileContent(owner: Types.ObjectId, projectId: string, rawPath: string) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);

  const file = await ProjectFileModel.findOne({
    project: project._id,
    owner,
    path,
    type: FileEntryType.FILE,
  });

  if (!file) {
    throw ApiError.notFound('File not found');
  }

  return file;
}

export async function createFile(
  owner: Types.ObjectId,
  projectId: string,
  rawPath: string,
  content = ''
) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);
  const parentPath = getParentPath(path);

  if (parentPath) {
    await assertParentFolderExists(project._id, owner, parentPath);
  }

  const checksum = computeChecksum(content);

  let file: ProjectFileDocument;
  try {
    file = await ProjectFileModel.create({
      project: project._id,
      owner,
      name: getBaseName(path),
      path,
      type: FileEntryType.FILE,
      content,
      language: detectLanguage(path),
      mimeType: detectMimeType(path),
      isBinary: isBinaryFile(path),
      checksum,
      parentPath,
      size: Buffer.byteLength(content, 'utf8'),
      version: 1,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw ApiError.conflict('A file or folder already exists at this path');
    }
    throw err;
  }

  await recordChange(project._id, file, FileChangeType.CREATE, owner, `Created "${path}"`);
  return file;
}

export async function createFolder(owner: Types.ObjectId, projectId: string, rawPath: string) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);
  const parentPath = getParentPath(path);

  if (parentPath) {
    await assertParentFolderExists(project._id, owner, parentPath);
  }

  let folder: ProjectFileDocument;
  try {
    folder = await ProjectFileModel.create({
      project: project._id,
      owner,
      name: getBaseName(path),
      path,
      type: FileEntryType.FOLDER,
      parentPath,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw ApiError.conflict('A file or folder already exists at this path');
    }
    throw err;
  }

  await recordChange(project._id, folder, FileChangeType.CREATE, owner, `Created folder "${path}"`);
  return folder;
}

export async function updateFileContent(
  owner: Types.ObjectId,
  projectId: string,
  rawPath: string,
  content: string,
  expectedVersion?: number
) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);

  const file = await ProjectFileModel.findOne({
    project: project._id,
    owner,
    path,
    type: FileEntryType.FILE,
  });

  if (!file) {
    throw ApiError.notFound('File not found');
  }

  if (expectedVersion !== undefined && file.version !== expectedVersion) {
    throw ApiError.conflict('This file was changed elsewhere. Reload before saving.');
  }

  const checksum = computeChecksum(content);

  // Nothing actually changed — skip the write, the version bump, and the history entry entirely
  // (spec §8: "prevent unnecessary saves").
  if (checksum === file.checksum) {
    return file;
  }

  file.content = content;
  file.size = Buffer.byteLength(content, 'utf8');
  file.checksum = checksum;
  file.version += 1;
  await file.save();

  await recordChange(project._id, file, FileChangeType.UPDATE, owner, `Updated "${path}"`);
  return file;
}

export async function renameEntry(
  owner: Types.ObjectId,
  projectId: string,
  rawPath: string,
  newName: string
) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);
  const parentPath = getParentPath(path);
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  const { entry, descendantsUpdated } = await moveOrRenameEntry(owner, project._id, path, newPath);

  if (newPath !== path) {
    const summary =
      descendantsUpdated > 0
        ? `Renamed "${path}" to "${newPath}" (${descendantsUpdated} items updated)`
        : `Renamed "${path}" to "${newPath}"`;
    await recordChange(project._id, entry, FileChangeType.RENAME, owner, summary);
  }

  return entry;
}

export async function deleteEntry(owner: Types.ObjectId, projectId: string, rawPath: string) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);

  const entry = await ProjectFileModel.findOne({ project: project._id, owner, path });

  if (!entry) {
    throw ApiError.notFound('File or folder not found');
  }

  // Capture the last known state as a version entry before it's gone, so a future snapshot/undo
  // feature can still resurrect it.
  await recordVersion({
    file: entry._id,
    project: project._id,
    owner,
    version: entry.version,
    content: entry.content ?? '',
    checksum: entry.checksum ?? computeChecksum(entry.content ?? ''),
    changedBy: owner,
    changeType: FileChangeType.DELETE,
  });

  if (entry.type === FileEntryType.FOLDER) {
    const selfOrDescendant = new RegExp(`^${escapeRegExp(path)}(/|$)`);
    const { deletedCount } = await ProjectFileModel.deleteMany({
      project: project._id,
      owner,
      path: { $regex: selfOrDescendant },
    });
    await logActivity({
      project: project._id,
      user: owner,
      file: entry._id,
      action: FileChangeType.DELETE,
      description: `Deleted folder "${path}" (${deletedCount} items)`,
    });
  } else {
    await entry.deleteOne();
    await logActivity({
      project: project._id,
      user: owner,
      file: entry._id,
      action: FileChangeType.DELETE,
      description: `Deleted "${path}"`,
    });
  }

  workspaceCache.invalidate(project._id.toString());
  await touchWorkspace(owner, project._id);
}

export interface FileSearchMatch {
  line: number;
  snippet: string;
}

export interface FileSearchResult {
  path: string;
  name: string;
  matches: FileSearchMatch[];
}

export async function searchFiles(
  owner: Types.ObjectId,
  projectId: string,
  query: string
): Promise<FileSearchResult[]> {
  const project = await assertProjectOwnership(owner, projectId);
  const pattern = new RegExp(escapeRegExp(query), 'i');

  const files = await ProjectFileModel.find({
    project: project._id,
    owner,
    type: FileEntryType.FILE,
    content: { $regex: pattern },
  })
    .select('path name content')
    .limit(50);

  return files.map((file) => {
    const matches = file.content
      .split('\n')
      .map((line, index) => ({ line: index + 1, snippet: line.trim() }))
      .filter((entry) => pattern.test(entry.snippet))
      .slice(0, 5);

    return { path: file.path, name: file.name, matches };
  });
}
