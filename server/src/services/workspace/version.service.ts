import { Types } from 'mongoose';
import { FileChangeType } from 'shared';
import { ProjectFileVersionModel } from '../../models';
import { ApiError } from '../../utils/ApiError';

interface RecordVersionInput {
  file: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  version: number;
  content: string;
  checksum: string;
  changedBy: Types.ObjectId;
  changeType: FileChangeType;
  changeSummary?: string;
}

/** Appends one immutable history entry — never mutates or trims prior versions (spec §6/§7). */
export async function recordVersion(input: RecordVersionInput) {
  return ProjectFileVersionModel.create(input);
}

export async function listVersions(
  owner: Types.ObjectId,
  project: Types.ObjectId,
  fileId: Types.ObjectId,
  cursor: string | undefined,
  limit: number
) {
  const filter: Record<string, unknown> = { project, owner, file: fileId };

  if (cursor) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await ProjectFileVersionModel.find(filter)
    .select('-content')
    .sort({ _id: -1 })
    .limit(limit + 1);

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);

  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]._id.toString() : null,
  };
}

export async function getVersion(owner: Types.ObjectId, project: Types.ObjectId, versionId: string) {
  if (!Types.ObjectId.isValid(versionId)) {
    throw ApiError.badRequest('Invalid version id');
  }

  const version = await ProjectFileVersionModel.findOne({ _id: versionId, project, owner });

  if (!version) {
    throw ApiError.notFound('Version not found');
  }

  return version;
}
