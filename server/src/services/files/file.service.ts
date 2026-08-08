import { Types } from 'mongoose';
import { detectLanguage, FileEntryType } from 'shared';
import { ProjectFileModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { isDuplicateKeyError } from '../../utils/mongoErrors';
import { getProjectById } from '../project.service';
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

  try {
    return await ProjectFileModel.create({
      project: project._id,
      owner,
      name: getBaseName(path),
      path,
      type: FileEntryType.FILE,
      content,
      language: detectLanguage(path),
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
}

export async function createFolder(owner: Types.ObjectId, projectId: string, rawPath: string) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);
  const parentPath = getParentPath(path);

  if (parentPath) {
    await assertParentFolderExists(project._id, owner, parentPath);
  }

  try {
    return await ProjectFileModel.create({
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

  file.content = content;
  file.size = Buffer.byteLength(content, 'utf8');
  file.version += 1;
  await file.save();

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

  const entry = await ProjectFileModel.findOne({ project: project._id, owner, path });

  if (!entry) {
    throw ApiError.notFound('File or folder not found');
  }

  const parentPath = getParentPath(path);
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  if (newPath === path) {
    return entry;
  }

  const conflict = await ProjectFileModel.exists({ project: project._id, owner, path: newPath });
  if (conflict) {
    throw ApiError.conflict('A file or folder already exists at this path');
  }

  if (entry.type === FileEntryType.FOLDER) {
    const prefixPattern = new RegExp(`^${escapeRegExp(path)}/`);
    const descendants = await ProjectFileModel.find({
      project: project._id,
      owner,
      path: { $regex: prefixPattern },
    });

    const bulkOps = descendants.map((doc) => {
      const updatedPath = newPath + doc.path.slice(path.length);
      const updatedParentPath =
        doc.parentPath === path ? newPath : (doc.parentPath?.replace(prefixPattern, `${newPath}/`) ?? null);

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { path: updatedPath, parentPath: updatedParentPath },
        },
      };
    });

    if (bulkOps.length > 0) {
      await ProjectFileModel.bulkWrite(bulkOps);
    }
  }

  entry.name = newName;
  entry.path = newPath;
  await entry.save();

  return entry;
}

export async function deleteEntry(owner: Types.ObjectId, projectId: string, rawPath: string) {
  const project = await assertProjectOwnership(owner, projectId);
  const path = assertSafePath(rawPath);

  const entry = await ProjectFileModel.findOne({ project: project._id, owner, path });

  if (!entry) {
    throw ApiError.notFound('File or folder not found');
  }

  if (entry.type === FileEntryType.FOLDER) {
    const selfOrDescendant = new RegExp(`^${escapeRegExp(path)}(/|$)`);
    await ProjectFileModel.deleteMany({ project: project._id, owner, path: { $regex: selfOrDescendant } });
  } else {
    await entry.deleteOne();
  }
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
