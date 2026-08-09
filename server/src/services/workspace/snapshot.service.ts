import { ClientSession, Types } from 'mongoose';
import { FileChangeType, FileEntryType, WorkspaceActivityAction } from 'shared';
import {
  ProjectFileModel,
  ProjectFileVersionModel,
  WorkspaceSnapshotModel,
} from '../../models';
import { ApiError } from '../../utils/ApiError';
import { computeChecksum } from '../../utils/checksum';
import { buildPaginationMeta } from '../../utils/paginate';
import { withTransaction } from '../../utils/withTransaction';
import { getProjectById } from '../project.service';
import { workspaceCache } from './cache.service';
import { recordVersion } from './version.service';
import { logActivity } from './workspace-activity.service';
import { ensureWorkspace, touchWorkspace } from './workspace.service';

async function buildSnapshotEntries(project: Types.ObjectId, owner: Types.ObjectId) {
  const files = await ProjectFileModel.find({ project, owner });

  return files.map((file) => ({
    file: file._id,
    path: file.path,
    type: file.type,
    version: file.version,
    checksum: file.checksum ?? computeChecksum(file.content ?? ''),
  }));
}

export async function createSnapshot(
  owner: Types.ObjectId,
  projectId: string,
  name: string,
  description: string | undefined,
  createdBy: Types.ObjectId
) {
  const project = await getProjectById(owner, projectId);
  const workspace = await ensureWorkspace(owner, project._id, project.frontend);
  const entries = await buildSnapshotEntries(project._id, owner);

  const snapshot = await WorkspaceSnapshotModel.create({
    project: project._id,
    owner,
    name,
    description,
    version: workspace.activeVersion,
    fileCount: entries.filter((entry) => entry.type === FileEntryType.FILE).length,
    createdBy,
    entries,
  });

  await logActivity({
    project: project._id,
    user: createdBy,
    action: WorkspaceActivityAction.SNAPSHOT,
    description: `Created snapshot "${name}"`,
  });

  return snapshot;
}

export async function listSnapshots(owner: Types.ObjectId, projectId: string, page: number, limit: number) {
  const project = await getProjectById(owner, projectId);
  const filter = { project: project._id, owner };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    WorkspaceSnapshotModel.find(filter).select('-entries').sort({ createdAt: -1 }).skip(skip).limit(limit),
    WorkspaceSnapshotModel.countDocuments(filter),
  ]);

  return { items, pagination: buildPaginationMeta(total, page, limit) };
}

async function restoreEntry(
  project: Types.ObjectId,
  owner: Types.ObjectId,
  entry: { file: Types.ObjectId; path: string; type: FileEntryType; version: number; checksum: string },
  changedBy: Types.ObjectId,
  session: ClientSession | undefined
) {
  const current = await ProjectFileModel.findOne({ project, owner, path: entry.path }).session(
    session ?? null
  );

  if (entry.type === FileEntryType.FOLDER) {
    if (!current) {
      const [created] = await ProjectFileModel.create(
        [
          {
            project,
            owner,
            name: entry.path.split('/').pop() ?? entry.path,
            path: entry.path,
            type: FileEntryType.FOLDER,
            parentPath: entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : null,
            version: 1,
          },
        ],
        { session: session ?? undefined }
      );
      await recordVersion({
        file: created._id,
        project,
        owner,
        version: created.version,
        content: '',
        checksum: computeChecksum(''),
        changedBy,
        changeType: FileChangeType.RESTORE,
      });
    }
    return;
  }

  // File: fetch the exact historical content this snapshot entry points at.
  const versionDoc = await ProjectFileVersionModel.findOne({
    file: entry.file,
    project,
    owner,
    version: entry.version,
  }).session(session ?? null);

  if (!versionDoc) return; // no recorded history for this entry — nothing safe to restore

  if (current) {
    if (current.checksum === entry.checksum) return; // already matches, nothing to do

    current.content = versionDoc.content;
    current.checksum = versionDoc.checksum;
    current.size = Buffer.byteLength(versionDoc.content, 'utf8');
    current.version += 1;
    await current.save({ session: session ?? undefined });

    await recordVersion({
      file: current._id,
      project,
      owner,
      version: current.version,
      content: current.content,
      checksum: current.checksum,
      changedBy,
      changeType: FileChangeType.RESTORE,
    });
  } else {
    const [created] = await ProjectFileModel.create(
      [
        {
          project,
          owner,
          name: entry.path.split('/').pop() ?? entry.path,
          path: entry.path,
          type: FileEntryType.FILE,
          content: versionDoc.content,
          checksum: versionDoc.checksum,
          parentPath: entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : null,
          size: Buffer.byteLength(versionDoc.content, 'utf8'),
          version: 1,
        },
      ],
      { session: session ?? undefined }
    );

    await recordVersion({
      file: created._id,
      project,
      owner,
      version: created.version,
      content: created.content,
      checksum: created.checksum ?? computeChecksum(created.content),
      changedBy,
      changeType: FileChangeType.RESTORE,
    });
  }
}

/**
 * Restores a project's files to a previous snapshot. Per spec §19, this NEVER silently destroys
 * current work — it first snapshots the current state as an automatic backup, then applies the
 * target snapshot: existing files are rewritten to their snapshotted content, deleted files are
 * recreated, and files created after the snapshot was taken are removed.
 */
export async function restoreSnapshot(owner: Types.ObjectId, projectId: string, snapshotId: string) {
  if (!Types.ObjectId.isValid(snapshotId)) {
    throw ApiError.badRequest('Invalid snapshot id');
  }

  const project = await getProjectById(owner, projectId);
  const target = await WorkspaceSnapshotModel.findOne({ _id: snapshotId, project: project._id, owner });

  if (!target) {
    throw ApiError.notFound('Snapshot not found');
  }

  const backup = await createSnapshot(
    owner,
    projectId,
    `Automatic backup before restoring "${target.name}"`,
    'Created automatically to preserve the workspace state before a snapshot restore.',
    owner
  );

  await withTransaction(async (session) => {
    for (const entry of target.entries) {
      await restoreEntry(project._id, owner, entry, owner, session);
    }

    const snapshotPaths = new Set(target.entries.map((entry) => entry.path));
    const currentFiles = await ProjectFileModel.find({ project: project._id, owner }).session(
      session ?? null
    );
    // Anything that exists now but wasn't part of the snapshot didn't exist at that point in time
    // — remove it so the restored state matches the snapshot exactly.
    const createdSincePaths = currentFiles
      .filter((file) => !snapshotPaths.has(file.path))
      .map((file) => file._id);

    if (createdSincePaths.length > 0) {
      await ProjectFileModel.deleteMany({ _id: { $in: createdSincePaths } }).session(session ?? null);
    }
  });

  await logActivity({
    project: project._id,
    user: owner,
    action: WorkspaceActivityAction.RESTORE,
    description: `Restored snapshot "${target.name}" (backed up as "${backup.name}")`,
  });

  workspaceCache.invalidate(project._id.toString());
  await touchWorkspace(owner, project._id);

  return { snapshot: target, backup };
}
