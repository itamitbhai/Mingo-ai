import { Types } from 'mongoose';
import { FileEntryType } from 'shared';
import { ProjectFileModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { getProjectById } from '../project.service';
import { assertSafePath, assertValidMove, escapeRegExp, getBaseName, getParentPath } from './path.service';

/**
 * Moves (or renames-in-place, when `newPath` shares the same parent) a file or folder to
 * `newPath`, cascading path/parentPath updates to every descendant when it's a folder. Shared by
 * `file.service.ts`'s `renameEntry` (same-parent rename) and this module's `moveFile`/`moveFolder`
 * (arbitrary destination) so the cascade logic exists exactly once.
 */
export async function moveOrRenameEntry(
  owner: Types.ObjectId,
  project: Types.ObjectId,
  path: string,
  newPath: string
) {
  const entry = await ProjectFileModel.findOne({ project, owner, path });

  if (!entry) {
    throw ApiError.notFound('File or folder not found');
  }

  if (newPath === path) {
    return { entry, descendantsUpdated: 0 };
  }

  if (entry.type === FileEntryType.FOLDER) {
    assertValidMove(path, newPath);
  }

  const conflict = await ProjectFileModel.exists({ project, owner, path: newPath });
  if (conflict) {
    throw ApiError.conflict('A file or folder already exists at this path');
  }

  let descendantsUpdated = 0;

  if (entry.type === FileEntryType.FOLDER) {
    const prefixPattern = new RegExp(`^${escapeRegExp(path)}/`);
    const descendants = await ProjectFileModel.find({ project, owner, path: { $regex: prefixPattern } });

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
      descendantsUpdated = bulkOps.length;
    }
  }

  entry.name = getBaseName(newPath);
  entry.path = newPath;
  entry.parentPath = getParentPath(newPath);
  await entry.save();

  return { entry, descendantsUpdated };
}

async function assertDestinationParentExists(
  project: Types.ObjectId,
  owner: Types.ObjectId,
  destinationPath: string
) {
  const parentPath = getParentPath(destinationPath);
  if (!parentPath) return;

  const parentExists = await ProjectFileModel.exists({
    project,
    owner,
    path: parentPath,
    type: FileEntryType.FOLDER,
  });

  if (!parentExists) {
    throw ApiError.badRequest('Destination folder does not exist');
  }
}

/** Moves a file or folder to an arbitrary destination path (spec §10) — as opposed to
 *  `file.service.ts`'s `renameEntry`, which only changes the leaf name within the same parent. */
export async function moveEntry(
  owner: Types.ObjectId,
  projectId: string,
  rawPath: string,
  rawDestinationPath: string
) {
  const project = await getProjectById(owner, projectId);
  const path = assertSafePath(rawPath);
  const destinationPath = assertSafePath(rawDestinationPath);

  await assertDestinationParentExists(project._id, owner, destinationPath);

  const { entry, descendantsUpdated } = await moveOrRenameEntry(owner, project._id, path, destinationPath);
  return { entry, descendantsUpdated, project };
}
